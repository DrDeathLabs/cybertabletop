# CyberTabletop – AWS Deployment Guide

This guide walks through a production-grade AWS deployment of CyberTabletop using managed services for high availability, security, and operational efficiency.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 – VPC and Networking](#step-1--vpc-and-networking)
4. [Step 2 – RDS PostgreSQL (Multi-AZ)](#step-2--rds-postgresql-multi-az)
5. [Step 3 – ElastiCache Redis Cluster](#step-3--elasticache-redis-cluster)
6. [Step 4 – ECR Repositories](#step-4--ecr-repositories)
7. [Step 5 – Build and Push Docker Images](#step-5--build-and-push-docker-images)
8. [Step 6 – ECS Cluster and Task Definitions](#step-6--ecs-cluster-and-task-definitions)
9. [Step 7 – Application Load Balancer and WAF](#step-7--application-load-balancer-and-waf)
10. [Step 8 – CloudFront Distribution](#step-8--cloudfront-distribution)
11. [Step 9 – AWS Secrets Manager](#step-9--aws-secrets-manager)
12. [Step 10 – Security: CloudTrail and GuardDuty](#step-10--security-cloudtrail-and-guardduty)
13. [Environment Variable Mapping](#environment-variable-mapping)
14. [SSL/TLS with ACM](#ssltls-with-acm)
15. [Auto-Scaling Configuration](#auto-scaling-configuration)
16. [Monitoring with CloudWatch](#monitoring-with-cloudwatch)
17. [Estimated Monthly Cost](#estimated-monthly-cost)

---

## 1. Architecture Overview

```
Internet
    │
    ▼
Route 53 (DNS)
    │
    ▼
CloudFront (CDN + DDoS)
    │
    ▼
ALB (HTTPS :443) ──── WAF (OWASP rules)
    │
    ├─── ECS Fargate Service: frontend  (React, port 3000)
    │
    └─── ECS Fargate Service: backend   (Node/Express, port 5000)
              │                │
              ▼                ▼
         RDS PostgreSQL   ElastiCache Redis
         (Multi-AZ)       (cluster mode)
              │
         Secrets Manager (all credentials)
```

| Component | AWS Service | Purpose |
|-----------|-------------|---------|
| Container orchestration | ECS Fargate | Serverless containers, no EC2 management |
| Database | RDS PostgreSQL Multi-AZ | Managed PostgreSQL with automated failover |
| Cache / Sessions | ElastiCache (Redis 7) | Session storage, real-time pub/sub |
| Load balancer | Application Load Balancer | Layer-7 routing, HTTPS termination |
| WAF | AWS WAF v2 | OWASP Core Rule Set, rate limiting |
| CDN | CloudFront | Global edge caching, additional DDoS protection |
| DNS | Route 53 | Hosted zone, health-checked failover records |
| TLS certificates | ACM | Managed, auto-renewing certificates |
| Secrets | Secrets Manager | Centralized credential management |
| Container registry | ECR | Private Docker image registry |
| Audit logs | CloudTrail | API call logging to S3 |
| Threat detection | GuardDuty | Anomaly and intrusion detection |

---

## 2. Prerequisites

- **AWS CLI v2** configured with sufficient permissions (`AdministratorAccess` for initial setup, tighten afterward)
- **Docker** (to build images locally)
- **A registered domain name** (can be transferred to or pointed at Route 53)
- **AWS account ID** – run `aws sts get-caller-identity --query Account --output text`
- Minimum recommended IAM permissions: ECS, ECR, RDS, ElastiCache, ALB, CloudFront, Route53, ACM, SecretsManager, WAF, CloudTrail, GuardDuty, IAM (for task roles)

```bash
# Verify AWS CLI is configured
aws sts get-caller-identity

# Set convenience variables used throughout this guide
export AWS_REGION="us-east-1"
export AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
export APP_NAME="cybertabletop"
export DOMAIN="yourdomain.com"   # Replace with your actual domain
```

---

## Step 1 – VPC and Networking

Create a dedicated VPC with public subnets (for the ALB) and private subnets (for ECS tasks, RDS, ElastiCache).

### 1.1 Create VPC

```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc \
  --cidr-block 10.0.0.0/16 \
  --tag-specifications "ResourceType=vpc,Tags=[{Key=Name,Value=${APP_NAME}-vpc}]" \
  --query 'Vpc.VpcId' --output text)

echo "VPC ID: $VPC_ID"

# Enable DNS hostnames (required for RDS)
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-support
```

### 1.2 Create Subnets

```bash
# Public subnets (ALB) – two AZs for redundancy
PUBLIC_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-public-1}]" \
  --query 'Subnet.SubnetId' --output text)

PUBLIC_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-public-2}]" \
  --query 'Subnet.SubnetId' --output text)

# Private subnets (ECS, RDS, ElastiCache)
PRIVATE_SUBNET_1=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.3.0/24 \
  --availability-zone ${AWS_REGION}a \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-private-1}]" \
  --query 'Subnet.SubnetId' --output text)

PRIVATE_SUBNET_2=$(aws ec2 create-subnet \
  --vpc-id $VPC_ID --cidr-block 10.0.4.0/24 \
  --availability-zone ${AWS_REGION}b \
  --tag-specifications "ResourceType=subnet,Tags=[{Key=Name,Value=${APP_NAME}-private-2}]" \
  --query 'Subnet.SubnetId' --output text)
```

### 1.3 Internet Gateway and NAT Gateway

```bash
# Internet Gateway (for public subnets)
IGW_ID=$(aws ec2 create-internet-gateway \
  --tag-specifications "ResourceType=internet-gateway,Tags=[{Key=Name,Value=${APP_NAME}-igw}]" \
  --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --internet-gateway-id $IGW_ID --vpc-id $VPC_ID

# Elastic IP + NAT Gateway (for private subnet outbound traffic)
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_GW_ID=$(aws ec2 create-nat-gateway \
  --subnet-id $PUBLIC_SUBNET_1 \
  --allocation-id $EIP_ALLOC \
  --tag-specifications "ResourceType=natgateway,Tags=[{Key=Name,Value=${APP_NAME}-nat}]" \
  --query 'NatGateway.NatGatewayId' --output text)

echo "Waiting for NAT Gateway to become available…"
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_ID
```

### 1.4 Route Tables

```bash
# Public route table
PUB_RTB=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP_NAME}-public-rtb}]" \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PUB_RTB --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 associate-route-table --route-table-id $PUB_RTB --subnet-id $PUBLIC_SUBNET_1
aws ec2 associate-route-table --route-table-id $PUB_RTB --subnet-id $PUBLIC_SUBNET_2

# Private route table (routes outbound through NAT)
PRIV_RTB=$(aws ec2 create-route-table --vpc-id $VPC_ID \
  --tag-specifications "ResourceType=route-table,Tags=[{Key=Name,Value=${APP_NAME}-private-rtb}]" \
  --query 'RouteTable.RouteTableId' --output text)
aws ec2 create-route --route-table-id $PRIV_RTB --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW_ID
aws ec2 associate-route-table --route-table-id $PRIV_RTB --subnet-id $PRIVATE_SUBNET_1
aws ec2 associate-route-table --route-table-id $PRIV_RTB --subnet-id $PRIVATE_SUBNET_2
```

### 1.5 Security Groups

```bash
# ALB security group (public internet → ALB)
ALB_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-alb-sg" \
  --description "ALB – allow HTTPS from internet" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG \
  --protocol tcp --port 80 --cidr 0.0.0.0/0   # for HTTP→HTTPS redirect

# ECS security group (ALB → ECS tasks)
ECS_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-ecs-sg" \
  --description "ECS tasks – allow traffic from ALB" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $ECS_SG \
  --protocol tcp --port 3000 --source-group $ALB_SG
aws ec2 authorize-security-group-ingress --group-id $ECS_SG \
  --protocol tcp --port 5000 --source-group $ALB_SG

# RDS security group (ECS → PostgreSQL)
RDS_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-rds-sg" \
  --description "RDS – allow PostgreSQL from ECS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $RDS_SG \
  --protocol tcp --port 5432 --source-group $ECS_SG

# Redis security group (ECS → Redis)
REDIS_SG=$(aws ec2 create-security-group \
  --group-name "${APP_NAME}-redis-sg" \
  --description "Redis – allow from ECS" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id $REDIS_SG \
  --protocol tcp --port 6379 --source-group $ECS_SG
```

---

## Step 2 – RDS PostgreSQL (Multi-AZ)

### 2.1 Create DB Subnet Group

```bash
aws rds create-db-subnet-group \
  --db-subnet-group-name "${APP_NAME}-db-subnet-group" \
  --db-subnet-group-description "CyberTabletop DB subnet group" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2
```

### 2.2 Create RDS Instance

```bash
# Store the DB password in Secrets Manager first (see Step 9)
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)

aws rds create-db-instance \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --engine-version "16.3" \
  --master-username cybertabletop \
  --master-user-password "${DB_PASSWORD}" \
  --db-name cybertabletop \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --vpc-security-group-ids $RDS_SG \
  --db-subnet-group-name "${APP_NAME}-db-subnet-group" \
  --backup-retention-period 7 \
  --preferred-backup-window "02:00-03:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --deletion-protection \
  --no-publicly-accessible \
  --tags "Key=Application,Value=${APP_NAME}"

echo "Waiting for RDS instance to become available (this may take 5–10 minutes)…"
aws rds wait db-instance-available --db-instance-identifier "${APP_NAME}-postgres"

RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "${APP_NAME}-postgres" \
  --query 'DBInstances[0].Endpoint.Address' --output text)
echo "RDS endpoint: $RDS_ENDPOINT"
```

---

## Step 3 – ElastiCache Redis Cluster

### 3.1 Create Cache Subnet Group

```bash
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name "${APP_NAME}-redis-subnet-group" \
  --cache-subnet-group-description "CyberTabletop Redis subnet group" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2
```

### 3.2 Create Redis Replication Group

```bash
REDIS_AUTH_TOKEN=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)

aws elasticache create-replication-group \
  --replication-group-id "${APP_NAME}-redis" \
  --replication-group-description "CyberTabletop Redis" \
  --cache-node-type cache.t3.medium \
  --engine redis \
  --engine-version "7.1" \
  --num-node-groups 1 \
  --replicas-per-node-group 1 \
  --cache-subnet-group-name "${APP_NAME}-redis-subnet-group" \
  --security-group-ids $REDIS_SG \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token "${REDIS_AUTH_TOKEN}" \
  --automatic-failover-enabled \
  --tags "Key=Application,Value=${APP_NAME}"

echo "Waiting for Redis cluster (this may take 5 minutes)…"
aws elasticache wait replication-group-available --replication-group-id "${APP_NAME}-redis"

REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id "${APP_NAME}-redis" \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' --output text)
echo "Redis primary endpoint: $REDIS_ENDPOINT"
```

---

## Step 4 – ECR Repositories

```bash
# Create ECR repository for backend
aws ecr create-repository \
  --repository-name "${APP_NAME}/backend" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region $AWS_REGION

# Create ECR repository for frontend
aws ecr create-repository \
  --repository-name "${APP_NAME}/frontend" \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256 \
  --region $AWS_REGION

echo "ECR repositories created:"
echo "  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}/backend"
echo "  ${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}/frontend"
```

---

## Step 5 – Build and Push Docker Images

```bash
# Authenticate Docker to ECR
aws ecr get-login-password --region $AWS_REGION \
  | docker login --username AWS \
    --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Set image tags
BACKEND_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}/backend:latest"
FRONTEND_IMAGE="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${APP_NAME}/frontend:latest"

# Build and push backend
docker build -t $BACKEND_IMAGE ./backend
docker push $BACKEND_IMAGE

# Build and push frontend (pass API URL as build arg)
docker build \
  --build-arg REACT_APP_API_URL="https://${DOMAIN}/api" \
  -t $FRONTEND_IMAGE \
  ./frontend
docker push $FRONTEND_IMAGE
```

---

## Step 6 – ECS Cluster and Task Definitions

### 6.1 Create ECS Cluster

```bash
aws ecs create-cluster \
  --cluster-name "${APP_NAME}-cluster" \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy \
    capacityProvider=FARGATE,weight=1,base=1 \
  --settings name=containerInsights,value=enabled \
  --tags key=Application,value=${APP_NAME}
```

### 6.2 Create IAM Task Execution Role

```bash
# Trust policy
cat > /tmp/ecs-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Service": "ecs-tasks.amazonaws.com" },
    "Action": "sts:AssumeRole"
  }]
}
EOF

aws iam create-role \
  --role-name "${APP_NAME}-ecs-task-execution-role" \
  --assume-role-policy-document file:///tmp/ecs-trust-policy.json

aws iam attach-role-policy \
  --role-name "${APP_NAME}-ecs-task-execution-role" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

# Allow reading from Secrets Manager
aws iam attach-role-policy \
  --role-name "${APP_NAME}-ecs-task-execution-role" \
  --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
```

### 6.3 Register Backend Task Definition

```bash
cat > /tmp/backend-task-def.json <<EOF
{
  "family": "${APP_NAME}-backend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${APP_NAME}-ecs-task-execution-role",
  "taskRoleArn":      "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${APP_NAME}-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "backend",
    "image": "${BACKEND_IMAGE}",
    "essential": true,
    "portMappings": [{ "containerPort": 5000, "protocol": "tcp" }],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/${APP_NAME}/backend",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "secrets": [
      { "name": "DATABASE_URL",        "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${APP_NAME}/DATABASE_URL" },
      { "name": "REDIS_URL",           "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${APP_NAME}/REDIS_URL" },
      { "name": "JWT_SECRET",          "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${APP_NAME}/JWT_SECRET" },
      { "name": "JWT_REFRESH_SECRET",  "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${APP_NAME}/JWT_REFRESH_SECRET" },
      { "name": "SESSION_SECRET",      "valueFrom": "arn:aws:secretsmanager:${AWS_REGION}:${AWS_ACCOUNT_ID}:secret:${APP_NAME}/SESSION_SECRET" }
    ],
    "environment": [
      { "name": "NODE_ENV",   "value": "production" },
      { "name": "PORT",       "value": "5000" }
    ],
    "healthCheck": {
      "command": ["CMD-SHELL", "curl -f http://localhost:5000/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 60
    }
  }]
}
EOF

aws ecs register-task-definition --cli-input-json file:///tmp/backend-task-def.json
```

### 6.4 Register Frontend Task Definition

```bash
cat > /tmp/frontend-task-def.json <<EOF
{
  "family": "${APP_NAME}-frontend",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${APP_NAME}-ecs-task-execution-role",
  "containerDefinitions": [{
    "name": "frontend",
    "image": "${FRONTEND_IMAGE}",
    "essential": true,
    "portMappings": [{ "containerPort": 3000, "protocol": "tcp" }],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/${APP_NAME}/frontend",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "environment": [
      { "name": "NODE_ENV", "value": "production" }
    ]
  }]
}
EOF

aws ecs register-task-definition --cli-input-json file:///tmp/frontend-task-def.json
```

### 6.5 Create CloudWatch Log Groups

```bash
aws logs create-log-group --log-group-name "/ecs/${APP_NAME}/backend"
aws logs create-log-group --log-group-name "/ecs/${APP_NAME}/frontend"
aws logs put-retention-policy --log-group-name "/ecs/${APP_NAME}/backend"  --retention-in-days 30
aws logs put-retention-policy --log-group-name "/ecs/${APP_NAME}/frontend" --retention-in-days 30
```

### 6.6 Create ECS Services

After creating the ALB (Step 7), run the following to create services. Replace `<BACKEND_TG_ARN>` and `<FRONTEND_TG_ARN>` with target group ARNs from Step 7.

```bash
# Backend service
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-backend" \
  --task-definition "${APP_NAME}-backend" \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNET_1},${PRIVATE_SUBNET_2}],securityGroups=[${ECS_SG}],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<BACKEND_TG_ARN>,containerName=backend,containerPort=5000" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200" \
  --health-check-grace-period-seconds 60

# Frontend service
aws ecs create-service \
  --cluster "${APP_NAME}-cluster" \
  --service-name "${APP_NAME}-frontend" \
  --task-definition "${APP_NAME}-frontend" \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[${PRIVATE_SUBNET_1},${PRIVATE_SUBNET_2}],securityGroups=[${ECS_SG}],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<FRONTEND_TG_ARN>,containerName=frontend,containerPort=3000" \
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200" \
  --health-check-grace-period-seconds 30
```

---

## Step 7 – Application Load Balancer and WAF

### 7.1 Create ALB

```bash
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name "${APP_NAME}-alb" \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Application,Value=${APP_NAME} \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB DNS: $ALB_DNS"
```

### 7.2 Create Target Groups

```bash
# Backend target group
BACKEND_TG_ARN=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-backend-tg" \
  --protocol HTTP --port 5000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# Frontend target group
FRONTEND_TG_ARN=$(aws elbv2 create-target-group \
  --name "${APP_NAME}-frontend-tg" \
  --protocol HTTP --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path / \
  --health-check-interval-seconds 30 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)
```

### 7.3 Create HTTPS Listener with Routing Rules

> **Note:** The ACM certificate ARN is required here. Complete Step 14 (SSL/TLS) first, then return.

```bash
# HTTPS listener (default: forward to frontend)
HTTPS_LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS --port 443 \
  --certificates CertificateArn=<ACM_CERT_ARN> \
  --default-actions Type=forward,TargetGroupArn=$FRONTEND_TG_ARN \
  --query 'Listeners[0].ListenerArn' --output text)

# Routing rule: /api/* → backend
aws elbv2 create-rule \
  --listener-arn $HTTPS_LISTENER_ARN \
  --priority 10 \
  --conditions '[{"Field":"path-pattern","Values":["/api/*"]}]' \
  --actions "[{\"Type\":\"forward\",\"TargetGroupArn\":\"${BACKEND_TG_ARN}\"}]"

# HTTP → HTTPS redirect
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP --port 80 \
  --default-actions 'Type=redirect,RedirectConfig={Protocol=HTTPS,Port=443,StatusCode=HTTP_301}'
```

### 7.4 Create AWS WAF Web ACL

```bash
WAF_ACL_ARN=$(aws wafv2 create-web-acl \
  --name "${APP_NAME}-waf" \
  --scope REGIONAL \
  --region $AWS_REGION \
  --default-action Allow={} \
  --rules '[
    {
      "Name": "AWSManagedRulesCommonRuleSet",
      "Priority": 1,
      "OverrideAction": {"None": {}},
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesCommonRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "CommonRuleSet"
      }
    },
    {
      "Name": "AWSManagedRulesKnownBadInputsRuleSet",
      "Priority": 2,
      "OverrideAction": {"None": {}},
      "Statement": {
        "ManagedRuleGroupStatement": {
          "VendorName": "AWS",
          "Name": "AWSManagedRulesKnownBadInputsRuleSet"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "KnownBadInputs"
      }
    },
    {
      "Name": "RateLimit",
      "Priority": 3,
      "Action": {"Block": {}},
      "Statement": {
        "RateBasedStatement": {
          "Limit": 2000,
          "AggregateKeyType": "IP"
        }
      },
      "VisibilityConfig": {
        "SampledRequestsEnabled": true,
        "CloudWatchMetricsEnabled": true,
        "MetricName": "RateLimit"
      }
    }
  ]' \
  --visibility-config \
    SampledRequestsEnabled=true,CloudWatchMetricsEnabled=true,MetricName="${APP_NAME}-waf" \
  --query 'Summary.ARN' --output text)

# Associate WAF with ALB
aws wafv2 associate-web-acl \
  --web-acl-arn $WAF_ACL_ARN \
  --resource-arn $ALB_ARN \
  --region $AWS_REGION
```

---

## Step 8 – CloudFront Distribution

```bash
aws cloudfront create-distribution \
  --distribution-config "{
    \"CallerReference\": \"${APP_NAME}-$(date +%s)\",
    \"Comment\": \"CyberTabletop CDN\",
    \"DefaultCacheBehavior\": {
      \"TargetOriginId\": \"alb-origin\",
      \"ViewerProtocolPolicy\": \"redirect-to-https\",
      \"AllowedMethods\": { \"Quantity\": 7, \"Items\": [\"GET\",\"HEAD\",\"OPTIONS\",\"PUT\",\"POST\",\"PATCH\",\"DELETE\"], \"CachedMethods\": { \"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"] } },
      \"ForwardedValues\": { \"QueryString\": true, \"Cookies\": { \"Forward\": \"all\" }, \"Headers\": { \"Quantity\": 1, \"Items\": [\"*\"] } },
      \"MinTTL\": 0, \"DefaultTTL\": 0, \"MaxTTL\": 31536000,
      \"Compress\": true
    },
    \"Origins\": {
      \"Quantity\": 1,
      \"Items\": [{
        \"Id\": \"alb-origin\",
        \"DomainName\": \"${ALB_DNS}\",
        \"CustomOriginConfig\": {
          \"HTTPSPort\": 443,
          \"OriginProtocolPolicy\": \"https-only\",
          \"OriginSSLProtocols\": { \"Quantity\": 1, \"Items\": [\"TLSv1.2\"] }
        }
      }]
    },
    \"Enabled\": true,
    \"Aliases\": { \"Quantity\": 1, \"Items\": [\"${DOMAIN}\"] },
    \"ViewerCertificate\": {
      \"ACMCertificateArn\": \"<ACM_CERT_ARN_US_EAST_1>\",
      \"SSLSupportMethod\": \"sni-only\",
      \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
    },
    \"HttpVersion\": \"http2and3\",
    \"WebACLId\": \"\"
  }"
```

> **Note:** CloudFront requires the ACM certificate to be in `us-east-1` regardless of your deployment region. Request a separate certificate in `us-east-1` for the CloudFront distribution.

---

## Step 9 – AWS Secrets Manager

Store all sensitive configuration values as individual secrets or as a single JSON secret.

```bash
# Store secrets individually (recommended for per-secret rotation)
store_secret() {
    local name="$1"
    local value="$2"
    aws secretsmanager create-secret \
      --name "${APP_NAME}/${name}" \
      --secret-string "${value}" \
      --region $AWS_REGION \
      --tags Key=Application,Value=${APP_NAME} 2>/dev/null \
    || aws secretsmanager put-secret-value \
         --secret-id "${APP_NAME}/${name}" \
         --secret-string "${value}" \
         --region $AWS_REGION
}

store_secret "DATABASE_URL"       "postgresql://cybertabletop:${DB_PASSWORD}@${RDS_ENDPOINT}:5432/cybertabletop"
store_secret "REDIS_URL"          "rediss://:${REDIS_AUTH_TOKEN}@${REDIS_ENDPOINT}:6379/0"
store_secret "JWT_SECRET"         "$(openssl rand -hex 32)"
store_secret "JWT_REFRESH_SECRET" "$(openssl rand -hex 32)"
store_secret "SESSION_SECRET"     "$(openssl rand -hex 16)"
```

---

## Step 10 – Security: CloudTrail and GuardDuty

### 10.1 Enable CloudTrail

```bash
# Create S3 bucket for CloudTrail logs
TRAIL_BUCKET="${APP_NAME}-cloudtrail-logs-${AWS_ACCOUNT_ID}"
aws s3 mb s3://${TRAIL_BUCKET} --region $AWS_REGION

# Set bucket policy for CloudTrail
cat > /tmp/cloudtrail-bucket-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": { "Service": "cloudtrail.amazonaws.com" },
      "Action": "s3:GetBucketAcl",
      "Resource": "arn:aws:s3:::${TRAIL_BUCKET}"
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": { "Service": "cloudtrail.amazonaws.com" },
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::${TRAIL_BUCKET}/AWSLogs/${AWS_ACCOUNT_ID}/*",
      "Condition": { "StringEquals": { "s3:x-amz-acl": "bucket-owner-full-control" } }
    }
  ]
}
EOF
aws s3api put-bucket-policy --bucket $TRAIL_BUCKET --policy file:///tmp/cloudtrail-bucket-policy.json

# Create multi-region trail
aws cloudtrail create-trail \
  --name "${APP_NAME}-trail" \
  --s3-bucket-name $TRAIL_BUCKET \
  --is-multi-region-trail \
  --enable-log-file-validation \
  --include-global-service-events

aws cloudtrail start-logging --name "${APP_NAME}-trail"
```

### 10.2 Enable GuardDuty

```bash
# Enable GuardDuty detector
DETECTOR_ID=$(aws guardduty create-detector \
  --enable \
  --finding-publishing-frequency FIFTEEN_MINUTES \
  --query 'DetectorId' --output text)

echo "GuardDuty Detector ID: $DETECTOR_ID"

# Create SNS topic for GuardDuty alerts
ALERT_TOPIC=$(aws sns create-topic --name "${APP_NAME}-security-alerts" \
  --query 'TopicArn' --output text)

# Subscribe your security team email
aws sns subscribe \
  --topic-arn $ALERT_TOPIC \
  --protocol email \
  --notification-endpoint "security@${DOMAIN}"

# EventBridge rule to route HIGH/CRITICAL GuardDuty findings to SNS
aws events put-rule \
  --name "${APP_NAME}-guardduty-alerts" \
  --event-pattern '{
    "source": ["aws.guardduty"],
    "detail-type": ["GuardDuty Finding"],
    "detail": { "severity": [{ "numeric": [">=", 7] }] }
  }' \
  --state ENABLED

aws events put-targets \
  --rule "${APP_NAME}-guardduty-alerts" \
  --targets "Id=SecurityAlert,Arn=${ALERT_TOPIC}"
```

---

## Environment Variable Mapping

The following table maps `.env` file variables to their AWS Secrets Manager paths and how they are injected into ECS task definitions.

| .env Key | Secrets Manager Path | Notes |
|---|---|---|
| `DATABASE_URL` | `cybertabletop/DATABASE_URL` | Full PostgreSQL connection string |
| `REDIS_URL` | `cybertabletop/REDIS_URL` | Full Redis TLS URL (`rediss://`) |
| `JWT_SECRET` | `cybertabletop/JWT_SECRET` | 64 hex chars |
| `JWT_REFRESH_SECRET` | `cybertabletop/JWT_REFRESH_SECRET` | 64 hex chars |
| `SESSION_SECRET` | `cybertabletop/SESSION_SECRET` | 32 hex chars |
| `POSTGRES_PASSWORD` | `cybertabletop/POSTGRES_PASSWORD` | Embedded in DATABASE_URL |
| `REDIS_PASSWORD` | `cybertabletop/REDIS_PASSWORD` | Embedded in REDIS_URL |
| `OIDC_CLIENT_ID` | `cybertabletop/OIDC_CLIENT_ID` | If SSO is configured |
| `OIDC_CLIENT_SECRET` | `cybertabletop/OIDC_CLIENT_SECRET` | If SSO is configured |
| `AI_API_KEY` | `cybertabletop/AI_API_KEY` | If AI features are enabled |

Variables are injected via the `secrets` block in the ECS task definition (see Step 6.3). ECS retrieves the values at container startup — no values are stored in the task definition itself.

---

## SSL/TLS with ACM

### Request Certificate

```bash
# Request a certificate for your domain (DNS validation recommended)
CERT_ARN=$(aws acm request-certificate \
  --domain-name "${DOMAIN}" \
  --subject-alternative-names "www.${DOMAIN}" \
  --validation-method DNS \
  --region $AWS_REGION \
  --query 'CertificateArn' --output text)

echo "Certificate ARN: $CERT_ARN"

# Get DNS validation record
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region $AWS_REGION \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord'
```

Add the CNAME record shown in the output to your DNS provider (or Route 53), then wait for validation:

```bash
aws acm wait certificate-validated --certificate-arn $CERT_ARN --region $AWS_REGION
echo "Certificate validated."
```

### Route 53 DNS Record

```bash
HOSTED_ZONE_ID=$(aws route53 list-hosted-zones-by-name \
  --dns-name "${DOMAIN}" \
  --query 'HostedZones[0].Id' --output text | sed 's|/hostedzone/||')

CF_DOMAIN="<your-cloudfront-distribution>.cloudfront.net"

aws route53 change-resource-record-sets \
  --hosted-zone-id $HOSTED_ZONE_ID \
  --change-batch "{
    \"Changes\": [{
      \"Action\": \"UPSERT\",
      \"ResourceRecordSet\": {
        \"Name\": \"${DOMAIN}\",
        \"Type\": \"A\",
        \"AliasTarget\": {
          \"HostedZoneId\": \"Z2FDTNDATAQYW2\",
          \"DNSName\": \"${CF_DOMAIN}\",
          \"EvaluateTargetHealth\": false
        }
      }
    }]
  }"
```

> The Hosted Zone ID `Z2FDTNDATAQYW2` is fixed for all CloudFront distributions.

---

## Auto-Scaling Configuration

```bash
# Register ECS service as scalable target
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id "service/${APP_NAME}-cluster/${APP_NAME}-backend" \
  --min-capacity 2 \
  --max-capacity 10

# CPU-based scaling policy (scale out when CPU > 70%)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id "service/${APP_NAME}-cluster/${APP_NAME}-backend" \
  --policy-name "${APP_NAME}-backend-cpu-scaling" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'

# Memory-based scaling policy (scale out when memory > 80%)
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --scalable-dimension ecs:service:DesiredCount \
  --resource-id "service/${APP_NAME}-cluster/${APP_NAME}-backend" \
  --policy-name "${APP_NAME}-backend-memory-scaling" \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 80.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageMemoryUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

---

## Monitoring with CloudWatch

### Create Dashboard

```bash
aws cloudwatch put-dashboard \
  --dashboard-name "${APP_NAME}-overview" \
  --dashboard-body "{
    \"widgets\": [
      {
        \"type\": \"metric\",
        \"properties\": {
          \"title\": \"ECS Backend CPU\",
          \"metrics\": [[\"AWS/ECS\",\"CPUUtilization\",\"ServiceName\",\"${APP_NAME}-backend\",\"ClusterName\",\"${APP_NAME}-cluster\"]],
          \"period\": 60, \"stat\": \"Average\", \"view\": \"timeSeries\"
        }
      },
      {
        \"type\": \"metric\",
        \"properties\": {
          \"title\": \"RDS Connections\",
          \"metrics\": [[\"AWS/RDS\",\"DatabaseConnections\",\"DBInstanceIdentifier\",\"${APP_NAME}-postgres\"]],
          \"period\": 60, \"stat\": \"Average\", \"view\": \"timeSeries\"
        }
      },
      {
        \"type\": \"metric\",
        \"properties\": {
          \"title\": \"ALB Request Count\",
          \"metrics\": [[\"AWS/ApplicationELB\",\"RequestCount\",\"LoadBalancer\",\"$(echo $ALB_ARN | cut -d: -f6)\"]],
          \"period\": 60, \"stat\": \"Sum\", \"view\": \"timeSeries\"
        }
      }
    ]
  }"
```

### CloudWatch Alarms

```bash
# High error rate alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "${APP_NAME}-high-5xx-errors" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --dimensions "Name=LoadBalancer,Value=$(echo $ALB_ARN | cut -d: -f6)" \
  --period 60 --evaluation-periods 3 \
  --statistic Sum --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $ALERT_TOPIC \
  --treat-missing-data notBreaching

# RDS CPU alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "${APP_NAME}-rds-high-cpu" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --dimensions "Name=DBInstanceIdentifier,Value=${APP_NAME}-postgres" \
  --period 300 --evaluation-periods 2 \
  --statistic Average --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions $ALERT_TOPIC
```

---

## Estimated Monthly Cost

Estimated costs for a small deployment supporting up to 50 concurrent users in `us-east-1`:

| Service | Configuration | Est. Monthly Cost |
|---|---|---|
| ECS Fargate (backend) | 2 tasks × 0.5 vCPU / 1 GB | ~$25 |
| ECS Fargate (frontend) | 2 tasks × 0.25 vCPU / 0.5 GB | ~$12 |
| RDS PostgreSQL | db.t3.medium Multi-AZ, 100 GB gp3 | ~$85 |
| ElastiCache Redis | cache.t3.medium, 1 replica | ~$50 |
| ALB | 1 instance + LCU charges | ~$25 |
| NAT Gateway | 1 gateway + data transfer | ~$35 |
| CloudFront | First 1 TB free, then $0.0085/GB | ~$5–15 |
| Route 53 | 1 hosted zone + queries | ~$1 |
| WAF | Web ACL + rule groups | ~$10 |
| Secrets Manager | 5–10 secrets | ~$1 |
| CloudTrail | Management events (free tier) | ~$0–5 |
| GuardDuty | Varies with event volume | ~$5–20 |
| CloudWatch | Logs, metrics, dashboards | ~$5–15 |
| **Total** | | **~$259–$344/month** |

> Costs can be reduced by using `FARGATE_SPOT` for non-critical tasks (~70% discount), choosing smaller RDS/ElastiCache instances, or using a Single-AZ RDS for non-production environments.
