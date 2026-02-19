"""
Script de migração: re-embeda todas as memórias com o novo modelo.
Necessário ao trocar de all-MiniLM-L6-v2 (384-dim) para all-mpnet-base-v2 (768-dim).

Fluxo:
  1. Lê todos os textos do banco antigo
  2. Deleta a tabela
  3. Re-embeda com o novo modelo
  4. Recria a tabela com os novos vetores
"""

import lancedb
from sentence_transformers import SentenceTransformer
import time

DB_PATH = "data/lancedb"
TABLE_NAME = "memories"
NEW_MODEL = "sentence-transformers/all-mpnet-base-v2"

def main():
    print("🔄 Iniciando migração de modelo de embedding...")
    print(f"   Novo modelo: {NEW_MODEL}")
    
    db = lancedb.connect(DB_PATH)
    
    # 1. Exporta dados existentes
    tbl = db.open_table(TABLE_NAME)
    df = tbl.to_pandas()
    total = len(df)
    
    if total == 0:
        print("⚠️ Banco vazio, nada a migrar.")
        return
    
    print(f"📊 Memórias a migrar: {total}")
    
    # Salva textos e metadados
    records = []
    for _, row in df.iterrows():
        records.append({
            "text": row["text"],
            "metadata": row["metadata"],
            "timestamp": row["timestamp"]
        })
    
    # 2. Carrega novo modelo
    print(f"🧠 Carregando modelo {NEW_MODEL}...")
    model = SentenceTransformer(NEW_MODEL)
    
    # 3. Re-embeda todos os textos
    print("🔄 Re-embedando memórias...")
    texts = [r["text"] for r in records]
    vectors = model.encode(texts, show_progress_bar=True)
    
    # 4. Recria a tabela
    print("🗑️ Deletando tabela antiga...")
    db.drop_table(TABLE_NAME)
    
    new_records = []
    for i, rec in enumerate(records):
        new_records.append({
            "text": rec["text"],
            "vector": vectors[i].tolist(),
            "metadata": rec["metadata"],
            "timestamp": rec["timestamp"]
        })
    
    print("✅ Criando tabela com novos vetores...")
    db.create_table(TABLE_NAME, new_records)
    
    print(f"\n✅ Migração concluída!")
    print(f"   Modelo: {NEW_MODEL}")
    print(f"   Dimensão: {len(vectors[0])}")
    print(f"   Memórias migradas: {total}")
    
    print("\n📋 Memórias:")
    for i, r in enumerate(records, 1):
        print(f"   {i}. {r['text']}")

if __name__ == "__main__":
    main()
