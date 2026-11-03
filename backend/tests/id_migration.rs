//! Upgrade a populated pre-0008 database, not just a fresh schema.
use sqlx::{Connection, Executor, PgConnection};
use volontiers_server::{id::EntityId, MIGRATOR};

#[tokio::test]
async fn hashes_existing_keys_and_preserves_relations_and_counters() {
    let admin_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL is required");
    let db = format!("vt_ids_{}", uuid::Uuid::new_v4().simple());
    let mut admin = PgConnection::connect(&admin_url).await.unwrap();
    admin.execute(format!("CREATE DATABASE {db}").as_str()).await.unwrap();
    let (base, _) = admin_url.rsplit_once('/').unwrap();
    let mut c = PgConnection::connect(&format!("{base}/{db}")).await.unwrap();
    for m in MIGRATOR.iter().filter(|m| m.version < 8) {
        sqlx::raw_sql(&m.sql).execute(&mut c).await.unwrap();
    }
    sqlx::raw_sql(include_str!("legacy_ids.sql")).execute(&mut c).await.unwrap();
    let fk_before: i64 = sqlx::query_scalar("SELECT count(*) FROM pg_constraint WHERE contype = 'f'").fetch_one(&mut c).await.unwrap();
    sqlx::raw_sql(&format!("BEGIN; {}; COMMIT;", include_str!("../migrations/0008_hashed_ids.sql")))
        .execute(&mut c).await.unwrap();
    let fk_after: i64 = sqlx::query_scalar("SELECT count(*) FROM pg_constraint WHERE contype = 'f'").fetch_one(&mut c).await.unwrap();
    assert_eq!(fk_before, fk_after);
    let counters: i64 = sqlx::query_scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'serial_id' AND data_type = 'integer' AND column_default LIKE 'nextval(%'").fetch_one(&mut c).await.unwrap();
    assert_eq!(counters, 12);
    let old_types: i64 = sqlx::query_scalar("SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND data_type IN ('uuid','bigint')").fetch_one(&mut c).await.unwrap();
    assert_eq!(old_types, 0);
    let legacy_event = EntityId::from_legacy("00000000-0000-0000-0000-000000000005".parse().unwrap());
    let linked: (EntityId, EntityId, String, String) = sqlx::query_as("SELECT e.id, a.entity_id, a.details->>'event', r.text FROM events e JOIN event_reviews r ON r.event_id = e.id JOIN audit_log a ON a.entity_id = e.id")
        .fetch_one(&mut c).await.unwrap();
    assert_eq!(linked.0, legacy_event);
    assert_eq!(linked.1, legacy_event);
    assert_eq!(linked.2, legacy_event.to_string());
    assert_eq!(linked.3, "Тестовый отзыв для миграции");
    let photo_relations: i64 = sqlx::query_scalar("SELECT count(*) FROM marker_closures c JOIN photos p ON p.id = c.photo_id JOIN map_markers m ON m.id = c.marker_id JOIN users u ON u.id = p.moderated_by AND u.id = c.submitted_by AND u.id = m.created_by").fetch_one(&mut c).await.unwrap();
    assert_eq!(photo_relations, 1);
    let fresh: Vec<(EntityId, i32)> = sqlx::query_as("INSERT INTO persons (first_name, last_name) VALUES ('Новый','Первый'), ('Новый','Второй') RETURNING id, serial_id").fetch_all(&mut c).await.unwrap();
    assert_ne!(fresh[0].0, fresh[1].0);
    assert_eq!(fresh[0].1, 2);
    assert_eq!(fresh[1].1, 3);
    assert!(sqlx::query("UPDATE audit_log SET action = 'tampered'").execute(&mut c).await.is_err());
    assert!(sqlx::query("INSERT INTO persons (id, first_name, last_name) VALUES ('123','Тест','Тест')").execute(&mut c).await.is_err());
    assert!(sqlx::query("UPDATE photos SET marker_id = repeat('f', 64)").execute(&mut c).await.is_err());
    c.close().await.unwrap();
    admin.execute(format!("DROP DATABASE {db}").as_str()).await.unwrap();
}
