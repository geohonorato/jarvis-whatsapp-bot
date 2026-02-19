"""
Script de limpeza de memórias duplicadas no LanceDB.
Algoritmo:
  1. Lê todas as memórias
  2. Ordena por timestamp (mais antiga primeiro)
  3. Para cada memória, verifica se já existe uma similar (L2 distance < 0.3) no set de "únicas"
  4. Se sim, marca como duplicata e remove
  5. Se não, mantém
"""

import lancedb
import numpy as np
from sentence_transformers import SentenceTransformer
import json

DB_PATH = "data/lancedb"
TABLE_NAME = "memories"
DEDUP_THRESHOLD = 0.3  # Distância L2 abaixo da qual consideramos duplicata

def main():
    print("🧹 Iniciando limpeza de memórias duplicadas...")
    
    db = lancedb.connect(DB_PATH)
    model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    
    tbl = db.open_table(TABLE_NAME)
    df = tbl.to_pandas()
    
    total = len(df)
    print(f"📊 Total de memórias no banco: {total}")
    
    if total == 0:
        print("✅ Banco vazio, nada a limpar.")
        return
    
    # Ordena por timestamp (mais antigas primeiro = são as "originais")
    df = df.sort_values("timestamp", ascending=True).reset_index(drop=True)
    
    # Conjunto de memórias únicas (texto + vetor)
    unique_texts = []
    unique_vectors = []
    duplicates = []
    
    for idx, row in df.iterrows():
        text = row["text"]
        vector = np.array(row["vector"])
        
        is_duplicate = False
        
        # Compara com todas as únicas já aceitas
        for uv in unique_vectors:
            distance = np.linalg.norm(vector - uv)
            if distance < DEDUP_THRESHOLD:
                is_duplicate = True
                break
        
        if is_duplicate:
            duplicates.append(text)
            print(f"  ❌ Duplicata: \"{text[:60]}...\"")
        else:
            unique_texts.append(text)
            unique_vectors.append(vector)
    
    print(f"\n📊 Resultado:")
    print(f"   Únicas: {len(unique_texts)}")
    print(f"   Duplicatas encontradas: {len(duplicates)}")
    
    if len(duplicates) == 0:
        print("✅ Nenhuma duplicata encontrada!")
        return
    
    # Recria a tabela só com as únicas
    print("\n🔄 Recriando tabela sem duplicatas...")
    
    # Filtra o dataframe original para manter só as únicas 
    # (pegamos o primeiro registro de cada grupo similar)
    unique_df = df[~df["text"].isin(duplicates)].reset_index(drop=True)
    
    # Workaround: drop e recria a tabela
    db.drop_table(TABLE_NAME)
    
    if len(unique_df) > 0:
        records = []
        for _, row in unique_df.iterrows():
            records.append({
                "text": row["text"],
                "vector": row["vector"].tolist() if hasattr(row["vector"], "tolist") else row["vector"],
                "metadata": row["metadata"],
                "timestamp": row["timestamp"]
            })
        db.create_table(TABLE_NAME, records)
    
    print(f"✅ Limpeza concluída! {len(duplicates)} duplicatas removidas.")
    print(f"📊 Memórias restantes: {len(unique_texts)}")
    
    print("\n📋 Memórias mantidas:")
    for i, text in enumerate(unique_texts, 1):
        print(f"   {i}. {text}")

if __name__ == "__main__":
    main()
