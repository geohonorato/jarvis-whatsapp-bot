import sys
import json
import lancedb
import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import time
import os

# --- CONFIGURAÇÃO ---
DB_PATH = "data/lancedb"
MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
TABLE_NAME = "memories"

# Configuração de saída UTF-8 para o Node.js ler corretamente
sys.stdout.reconfigure(encoding='utf-8')

# --- VARIÁVEIS GLOBAIS ---
db = None
model = None

def load_resources():
    global db, model
    try:
        print(json.dumps({"status": "info", "message": "Loading resources..."}))
        
        if not os.path.exists("data"):
            os.makedirs("data")
            
        db = lancedb.connect(DB_PATH)
        model = SentenceTransformer(MODEL_NAME)
        
        # Garante que a tabela existe (COM PROTEÇÃO CONTRA ERRO DE RACE CONDITION/LISTAGEM)
        try:
            if TABLE_NAME not in db.list_tables():
                dummy_vector = model.encode("init").tolist()
                data = [{
                    "text": "init",
                    "vector": dummy_vector,
                    "metadata": "{}",
                    "timestamp": time.time()
                }]
                db.create_table(TABLE_NAME, data)
                
                # Limpa dummy
                tbl = db.open_table(TABLE_NAME)
                tbl.delete("text = 'init'")
        except Exception as e:
            # Se der erro de que já existe, ignoramos e seguimos para abrir
            if "already exists" not in str(e):
                raise e
            
        print(json.dumps({"status": "ready", "message": "RAG Service Ready"}))
    except Exception as e:
        print(json.dumps({"status": "fatal", "message": str(e)}))
        sys.exit(1)

def handle_command(cmd_line):
    try:
        if not cmd_line.strip():
            return
            
        data = json.loads(cmd_line)
        command = data.get("command")
        args = data.get("args", {})
        
        if command == "add":
            text = args.get("text")
            metadata = args.get("metadata", "{}")
            
            tbl = db.open_table(TABLE_NAME)
            vector = model.encode(text).tolist()
            
            row = [{
                "text": text,
                "vector": vector,
                "metadata": metadata,
                "timestamp": time.time()
            }]
            tbl.add(row)
            print(json.dumps({"status": "success", "message": "Memory added"}))
            
        elif command == "search":
            query = args.get("query")
            limit = int(args.get("limit", 3))
            
            tbl = db.open_table(TABLE_NAME)
            query_vector = model.encode(query).tolist()
            
            results = tbl.search(query_vector).limit(limit).to_pandas()
            
            docs = []
            for _, row in results.iterrows():
                docs.append({
                    "text": row["text"],
                    "metadata": row["metadata"],
                    "timestamp": row["timestamp"],
                    "_distance": row["_distance"]
                })
            print(json.dumps({"status": "success", "data": docs}, ensure_ascii=False))
            
        elif command == "ping":
            print(json.dumps({"status": "pong"}))
            
        else:
            print(json.dumps({"status": "error", "message": "Unknown command"}))
            
    except Exception as e:
        print(json.dumps({"status": "error", "message": str(e)}))

def main():
    load_resources()
    
    # Loop de processamento de comandos
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            handle_command(line)
            sys.stdout.flush()
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(json.dumps({"status": "error", "message": f"Loop error: {str(e)}"}))
            sys.stdout.flush()

if __name__ == "__main__":
    main()
