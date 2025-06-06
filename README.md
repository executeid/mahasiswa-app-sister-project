# Students App for Distributed Systems Project

A Semester Final Project build of microservices-based academic management system for universities, built with Node.js, Kafka, PostgreSQL, and Kubernetes. This project is designed to handle student, academic, and logging services in a scalable and maintainable architecture.

## Features

- **Academic Service**: Manages classes, courses, lecturers, attendance, and reporting.
- **Mahasiswa API**: Handles student (mahasiswa) data and operations.
- **Consumer Service**: Consumes and logs events from Kafka topics for auditing and analytics.
- **Kafka Integration**: Asynchronous communication between services using Kafka.
- **PostgreSQL Databases**: Separate databases for academic, mahasiswa, and logging data.
- **Kubernetes Deployment**: All services and databases are containerized and orchestrated with Kubernetes for scalability and reliability.

## Project Structure

```
academic-service/      # Academic management microservice
mahasiswa-api/         # Student (mahasiswa) management microservice
consumer-service/      # Kafka consumer and logging microservice
kubernetes/            # Kubernetes manifests for deployment
```

## Tech Stack

- **Node.js** (Express.js)
- **PostgreSQL**
- **Kafka**
- **Docker**
- **Kubernetes**

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Kubernetes (Minikube, kind, or a cloud provider)
- Node.js (for local development)

### Local Development

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd mahasiswa-app-sister-project
   ```
2. Install dependencies for each service:
   ```bash
   cd academic-service && npm install
   cd ../mahasiswa-api && npm install
   cd ../consumer-service && npm install
   ```
3. Set up environment variables (see `*secret.yaml` in each service or create your own files).
4. Start services locally (example for academic-service):
   ```bash
   cd academic-service
   npm start
   ```

### Running with Docker Compose

_Coming soon!_

### Kubernetes Deployment

1. Make sure your Kubernetes cluster is running.
2. Apply secrets and configmaps:
   ```bash
   kubectl apply -f kubernetes/db-credentials-secret.yaml
   kubectl apply -f kubernetes/jwt-secret.yaml
   kubectl apply -f kubernetes/configmaps/app-configmap.yaml
   ```
3. Deploy databases, Kafka, and Zookeeper:
   ```bash
   kubectl apply -f kubernetes/01-volumes/
   kubectl apply -f kubernetes/02-databases/
   kubectl apply -f kubernetes/03-message-broker/
   ```
4. Deploy application services:
   ```bash
   kubectl apply -f kubernetes/04-application/
   kubectl apply -f kubernetes/05-services/
   kubectl apply -f kubernetes/06-ingress/
   ```
5. (Optional) Deploy pgAdmin for database management:
   ```bash
   kubectl apply -f kubernetes/pgadmin/
   ```

## API Documentation

Each service exposes RESTful APIs. See the `src/routes/` directory in each service for available endpoints.

## Contributing

Contributions are welcome! Please open issues or pull requests for improvements, bug fixes, or new features.

## License

MIT License

---

> Made with ❤️ by Execute to mark the end of Semester 4
