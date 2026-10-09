//! schema.graphql в корне репозитория — это контракт API. Тест не даёт ему разойтись с кодом.
//! Обновить файл: `cargo run -- schema > ../schema.graphql` (из каталога backend).
#[test]
fn schema_file_matches_code() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../schema.graphql");
    let on_disk = std::fs::read_to_string(path).expect("не найден schema.graphql");
    assert_eq!(
        on_disk.trim_end(),
        volontiers_server::graphql::sdl().trim_end(),
        "schema.graphql устарел: выполните `cargo run -- schema > ../schema.graphql`"
    );
}
