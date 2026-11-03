//! Database keys are SHA-256 hex strings. SERIAL counters stay private to SQL.
use std::{fmt, str::FromStr};

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{decode::Decode, encode::{Encode, IsNull}, error::BoxDynError,
    postgres::{PgArgumentBuffer, PgHasArrayType, PgTypeInfo, PgValueRef}, Postgres, Type};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct EntityId([u8; 64]);

impl EntityId {
    pub fn as_str(&self) -> &str {
        std::str::from_utf8(&self.0).expect("validated hexadecimal ID")
    }

    /// Matches migration 0008, including deterministic IDs of existing demo data.
    pub fn from_legacy(id: uuid::Uuid) -> Self {
        hex::encode(Sha256::digest(id.to_string().as_bytes())).parse().expect("SHA-256 hex")
    }
}

impl FromStr for EntityId {
    type Err = &'static str;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if s.len() != 64 || !s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b)) {
            return Err("expected 64 lowercase hexadecimal characters");
        }
        let mut bytes = [0; 64];
        bytes.copy_from_slice(s.as_bytes());
        Ok(Self(bytes))
    }
}
impl TryFrom<String> for EntityId {
    type Error = &'static str;
    fn try_from(s: String) -> Result<Self, Self::Error> { s.parse() }
}
impl From<EntityId> for String {
    fn from(id: EntityId) -> Self { id.as_str().to_owned() }
}
impl fmt::Display for EntityId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { f.write_str(self.as_str()) }
}
impl Type<Postgres> for EntityId {
    fn type_info() -> PgTypeInfo { <String as Type<Postgres>>::type_info() }
    fn compatible(ty: &PgTypeInfo) -> bool { <String as Type<Postgres>>::compatible(ty) }
}
impl PgHasArrayType for EntityId {
    fn array_type_info() -> PgTypeInfo { <String as PgHasArrayType>::array_type_info() }
}
impl<'q> Encode<'q, Postgres> for EntityId {
    fn encode_by_ref(&self, buf: &mut PgArgumentBuffer) -> Result<IsNull, BoxDynError> {
        <String as Encode<Postgres>>::encode(self.to_string(), buf)
    }
}
impl<'r> Decode<'r, Postgres> for EntityId {
    fn decode(value: PgValueRef<'r>) -> Result<Self, BoxDynError> {
        <&str as Decode<Postgres>>::decode(value)?.parse().map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_ids_and_roundtrips_json() {
        let id = EntityId::from_legacy(uuid::Uuid::nil());
        assert_eq!(id.to_string(), hex::encode(Sha256::digest(b"00000000-0000-0000-0000-000000000000")));
        assert_eq!(serde_json::from_str::<EntityId>(&serde_json::to_string(&id).unwrap()).unwrap(), id);
        for bad in ["1", "00000000-0000-0000-0000-000000000000", &"A".repeat(64), &"g".repeat(64)] {
            assert!(bad.parse::<EntityId>().is_err());
        }
    }
}
