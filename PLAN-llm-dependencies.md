# Fork Tales — LLM Dependencies Plan (Docker-First, Realistic Path)

> Goal: run as much of the AI stack as possible in Docker, with minimal host assumptions.

---

## 1) Docker topology (recommended)

Run these components:

- **Ollama** (container, host port `11434`) for text generation + weaver LLM calls
- **eta-mu-system** (`part64/docker-compose.yml`) for world + IO + weaver runtime
- **eta-mu-gateway** (`nginx`) for runtime ingress
- **ChromaDB** (already part of `part64/docker-compose.yml` as `chroma`)

This keeps almost everything containerized and avoids host Python/PM2 setup.

---

## 2) One-time setup

### A) Start Ollama in Docker

```bash
docker run -d --name eta-mu-ollama \
  -p 11434:11434 \
  -v eta-mu-ollama:/root/.ollama \
  ollama/ollama:latest
```

Verify:

```bash
curl -s http://127.0.0.1:11434/api/tags
```

### B) Pull at least one chat model

For quick smoke tests:

```bash
docker exec eta-mu-ollama ollama pull qwen2.5:0.5b
docker exec eta-mu-ollama ollama list
```

---

## 3) Runtime bring-up (portable local profile)

Base compose currently mounts `/dev/accel` (NPU). On hosts without that device, startup fails.
Use the included override profile:

- `part64/docker-compose.local-llm.yml`

This override:
- removes required `/dev/accel` + `gpus` mapping
- points `TEXT_GENERATION_BASE_URL` + `WEAVER_LLM_BASE_URL` to `http://host.docker.internal:11434`
- sets a small model (`qwen2.5:0.5b`) for text + weaver
- disables vision by default
- clears auth headers/tokens for local Ollama

Start stack (using alternate ports to avoid local conflicts):

```bash
cd /home/shuv/repos/fork_tales/part64
ETA_MU_GATEWAY_PORT=18887 ETA_MU_WEAVER_PORT=18997 \
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.local-llm.yml \
    up -d --build eta-mu-system eta-mu-gateway
```

Check status:

```bash
ETA_MU_GATEWAY_PORT=18887 ETA_MU_WEAVER_PORT=18997 \
  docker compose -f docker-compose.yml -f docker-compose.local-llm.yml ps
```

---

## 4) Verification checklist

### Runtime + gateway

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18887/
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:18887/api/catalog
curl -s http://127.0.0.1:18887/api/runtime/health | python3 -m json.tool | head -30
```

### WebSocket accept

```bash
python3 - <<'PY'
import socket,base64,os
h,p='127.0.0.1',18887
k=base64.b64encode(os.urandom(16)).decode()
req=(f"GET /ws HTTP/1.1\r\nHost: {h}:{p}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {k}\r\nSec-WebSocket-Version: 13\r\n\r\n")
s=socket.create_connection((h,p),timeout=5); s.sendall(req.encode())
print(s.recv(4096).decode('latin1','ignore').split('\r\n')[0]); s.close()
PY
```

Expected first line: `HTTP/1.1 101 Switching Protocols`

### Chat (LLM path)

```bash
curl -s -X POST http://127.0.0.1:18887/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","text":"Give me one sentence about Gates of Truth."}]}' \
  | python3 -m json.tool | head -40
```

Expected: response includes `"mode": "llm"` and model set to your Ollama model.

### Weaver LLM

```bash
curl -s http://127.0.0.1:18997/api/weaver/status | python3 -m json.tool | head -40

curl -s -X POST http://127.0.0.1:18997/api/weaver/control \
  -H 'Content-Type: application/json' \
  -d '{"action":"start","seeds":["https://en.wikipedia.org/wiki/Artificial_intelligence"]}' \
  | python3 -m json.tool | head -40

sleep 8
curl -s http://127.0.0.1:18997/api/weaver/status | python3 -m json.tool | head -60
```

Expected after crawl activity:
- `metrics.fetched` increases
- `metrics.llm_analysis_success` increases (when LLM summarization succeeds)

---

## 5) Current realistic limitation (important)

In current code, embedding generation is tied to local hardware C runtime paths (`openvino/torch/auto`), not direct Ollama embedding RPC as primary path.

On hosts without required NPU/CUDA runtime, embeddings may remain degraded even when chat/weaver LLM are healthy.

What still works well in this Docker profile:
- world runtime + gateway
- chat LLM responses
- weaver crawl + LLM summaries
- Chroma service availability

What may degrade:
- embedding-backed semantic paths if C embedding runtime is unavailable.

---

## 6) Stop / cleanup

Stop compose stack:

```bash
cd /home/shuv/repos/fork_tales/part64
ETA_MU_GATEWAY_PORT=18887 ETA_MU_WEAVER_PORT=18997 \
  docker compose -f docker-compose.yml -f docker-compose.local-llm.yml down
```

Stop Ollama container:

```bash
docker stop eta-mu-ollama
```
