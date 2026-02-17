# Event-Driven Cloud Deployment Platform

A scalable, event-driven, cloud-native deployment platform inspired by Vercel. Built using distributed systems principles, Kafka-based event streaming, containerized build workers, and S3-backed static hosting.

## Overview

The Event-Driven Cloud Deployment Platform is a full-stack cloud system that enables users to:

- Create projects
- Trigger deployments
- Build repositories in isolated containers
- Stream real-time logs
- Host static builds on AWS S3
- Serve deployments via a reverse proxy
- Track deployment history

### Key Concepts Demonstrated

- Event-driven architecture
- Distributed systems design
- Asynchronous processing
- Cloud infrastructure (AWS)
- Real-time log streaming
- Secure authentication & multi-tenant architecture

## System Architecture

```
                ┌─────────────────────┐
                │      Frontend       │
                │  React + Vite SPA   │
                └─────────┬───────────┘
                          │ REST + Socket
                          ▼
                ┌─────────────────────┐
                │     API Server      │
                │  Express + Prisma   │
                └─────────┬───────────┘
                          │
                          │ Triggers ECS Task
                          ▼
                ┌─────────────────────┐
                │    Build Server     │
                │  Docker Container   │
                └─────────┬───────────┘
                          │
                          │ Publishes Logs
                          ▼
                     ┌──────────┐
                     │  Kafka   │
                     └────┬─────┘
                          │
                          ▼
                ┌─────────────────────┐
                │    API Consumer     │
                │  Inserts Logs       │
                └─────────┬───────────┘
                          │
                          ▼
                     ClickHouse
                          │
                          ▼
                        Socket.io
                          │
                          ▼
                      Frontend UI
```

**Deployment Artifacts Flow:** Build Server → AWS S3 → Reverse Proxy → Live URL

### Architecture Patterns

- Event-driven architecture
- Producer-consumer model
- Distributed build workers
- Stateless API layer
- Horizontal scalability

## Project Structure

```
Event-Driven-Cloud-Deployment-Platform/
├── api-server/                 # Backend API Server
│   ├── prisma/
│   ├── index.js
│   └── package.json
├── build-server/               # Isolated build worker
│   ├── Dockerfile
│   ├── script.js
│   └── main.sh
├── frontend/                   # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── api.js
├── s3-reverse-proxy/           # Subdomain routing layer
│   └── index.js
├── .env.example
└── README.md
```

## Tech Stack

### Frontend
- React (Vite)
- React Router
- Axios
- Socket.io Client

### Backend
- Node.js
- Express.js
- Prisma ORM
- PostgreSQL
- JWT Authentication

### Build Worker
- Docker
- Node.js
- Git
- Kafka Producer

### Event Streaming
- Apache Kafka (Aiven)
- KafkaJS

### Log Storage
- ClickHouse

### Cloud Infrastructure
- AWS ECS (Fargate)
- AWS S3
- IAM
- Subdomain Reverse Proxy

## Authentication Flow

1. User registers/logs in
2. JWT token issued and stored in frontend
3. Protected routes guarded by token verification
4. API middleware validates token on requests

## Deployment Flow

1. User initiates deployment
2. API validates project ownership
3. Deployment record created with QUEUED status
4. ECS task triggered with build container
5. Build container:
   - Clones repository
   - Installs dependencies
   - Runs build process
   - Uploads output to S3
   - Streams logs to Kafka
6. API consumer:
   - Reads logs from Kafka
   - Inserts logs into ClickHouse
   - Updates deployment status
   - Emits logs via Socket.io
7. User receives real-time logs
8. Live URL becomes available upon success

## Features

- ✅ Multi-project support
- ✅ Real-time log streaming
- ✅ Deployment history tracking
- ✅ Subdomain routing
- ✅ Isolated build environments
- ✅ Secure authentication middleware
- ✅ Cloud-native architecture
- ✅ Event-driven processing

## API Endpoints

### Authentication
- `POST /register`
- `POST /login`

### Projects
- `POST /project`
- `GET /project/:id`
- `GET /projects`

### Deployments
- `POST /deploy`
- `GET /logs/:deploymentId`

## Local Development Setup

### Clone Repository
```bash
git clone <repo-url>
```

### Setup API Server
```bash
cd api-server
npm install
npx prisma migrate dev
node index.js
```

### Run Frontend
```bash
cd frontend
npm install
npm run dev
```

### Run Reverse Proxy
```bash
cd s3-reverse-proxy
node index.js
```

## Scalability Considerations

- Stateless API servers enable horizontal scaling
- Kafka enables distributed log processing across consumers
- Build workers scale dynamically via ECS
- S3 provides unlimited storage capacity
- Reverse proxy supports efficient subdomain routing

## Key Achievements

- Designed and implemented event-driven cloud deployment system
- Built distributed logging pipeline using Kafka and ClickHouse
- Implemented containerized build workers via AWS ECS
- Architected real-time streaming using WebSockets
- Implemented multi-tenant project isolation
- Created cloud-native static hosting with S3

## Technical Learning Outcomes

- Event-driven architecture in production systems
- Distributed system debugging and optimization
- Kafka consumer group management
- Cloud deployment orchestration
- Real-time data streaming patterns
- Scalable system design principles

## Future Enhancements

- CI/CD integration (GitHub Actions)
- GitHub OAuth support
- Custom domain configuration
- Deployment rollback capabilities
- Horizontal scaling for build workers
- Observability stack (Prometheus + Grafana)

---

**Author:** Vamshi Kumar  
Full Stack Developer | Cloud Enthusiast | Distributed Systems Learner


## System Architecture Diagram

![System design](./system-design.png)

