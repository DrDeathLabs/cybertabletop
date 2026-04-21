# CyberTabletop – Azure Deployment Guide

This guide walks through a production-grade Azure deployment of CyberTabletop using managed Azure services for high availability, security, and operational efficiency. It includes a dedicated section for Microsoft Entra ID (Azure AD) SSO integration.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites](#2-prerequisites)
3. [Step 1 – Resource Group](#step-1--resource-group)
4. [Step 2 – Azure Container Registry](#step-2--azure-container-registry)
5. [Step 3 – Azure Database for PostgreSQL Flexible Server](#step-3--azure-database-for-postgresql-flexible-server)
6. [Step 4 – Azure Cache for Redis](#step-4--azure-cache-for-redis)
7. [Step 5 – Build and Push Images to ACR](#step-5--build-and-push-images-to-acr)
8. [Step 6 – App Service Plan and Web Apps](#step-6--app-service-plan-and-web-apps)
9. [Step 7 – Application Gateway with WAF](#step-7--application-gateway-with-waf)
10. [Step 8 – Azure Key Vault for Secrets](#step-8--azure-key-vault-for-secrets)
11. [Step 9 – Azure Monitor and Log Analytics](#step-9--azure-monitor-and-log-analytics)
12. [Step 10 – Microsoft Sentinel (Optional)](#step-10--microsoft-sentinel-optional)
13. [Step 11 – Microsoft Entra ID SSO Integration](#step-11--microsoft-entra-id-sso-integration)
14. [Environment Variable Mapping](#environment-variable-mapping)
15. [SSL/TLS with Azure-Managed Certificates](#ssltls-with-azure-managed-certificates)
16. [Auto-Scaling Configuration](#auto-scaling-configuration)
17. [Estimated Monthly Cost](#estimated-monthly-cost)

---

## 1. Architecture Overview

```
Internet
    │
    ▼
Azure Front Door (CDN + DDoS + WAF)
    │
    ▼
Application Gateway (WAF v2, SSL termination)
    │
    ├─── App Service: frontend   (React, Node, port 3000)
    │
    └─── App Service: backend    (Node/Express, port 5000)
              │                │
              ▼                ▼
      Azure Database        Azure Cache
      PostgreSQL            for Redis
      Flexible Server       (Enterprise)
              │
         Azure Key Vault (all secrets)
              │
       Microsoft Entra ID (SSO/OIDC)
              │
       Azure Monitor + Log Analytics
              │
       Microsoft Sentinel (optional)
```

| Component | Azure Service | Purpose |
|---|---|---|
| Container orchestration | App Service (Linux containers) | Managed hosting, built-in TLS, easy scaling |
| Database | Azure Database for PostgreSQL Flexible Server | Managed PostgreSQL, zone-redundant HA |
| Cache / Sessions | Azure Cache for Redis | Session storage, real-time pub/sub |
| Load balancer / WAF | Application Gateway v2 + WAF | Layer-7 routing, OWASP rule sets |
| CDN / Global entry | Azure Front Door | Global CDN, DDoS protection, WAF |
| DNS | Azure DNS | Hosted zones, alias records |
| TLS certificates | App Service Managed Certificates | Free, auto-renewing certificates |
| Secrets | Azure Key Vault | Centralized secret management with RBAC |
| Container registry | Azure Container Registry | Private Docker registry |
| Identity / SSO | Microsoft Entra ID (Azure AD) | OIDC/OAuth2 SSO for enterprise users |
| Monitoring | Azure Monitor + Log Analytics | Metrics, logs, alerts, dashboards |
| SIEM | Microsoft Sentinel | Advanced threat detection (optional) |

---

## 2. Prerequisites

- **Azure CLI** (`az`) version 2.50+ — [Install guide](https://docs.microsoft.com/cli/azure/install-azure-cli)
- **Docker** (to build images locally)
- **A registered domain name** (can be delegated to Azure DNS)
- An **Azure subscription** with Contributor or Owner access
- The **Resource Provider** `Microsoft.ContainerRegistry`, `Microsoft.Web`, `Microsoft.DBforPostgreSQL`, `Microsoft.Cache`, `Microsoft.KeyVault` must be registered

```bash
# Log in and set subscription
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"

# Register required providers
az provider register --namespace Microsoft.ContainerRegistry
az provider register --namespace Microsoft.Web
az provider register --namespace Microsoft.DBforPostgreSQL
az provider register --namespace Microsoft.Cache
az provider register --namespace Microsoft.KeyVault
az provider register --namespace Microsoft.OperationalInsights
az provider register --namespace Microsoft.Network

# Set convenience variables used throughout this guide
LOCATION="eastus"
APP_NAME="cybertabletop"
RG="${APP_NAME}-rg"
DOMAIN="yourdomain.com"   # Replace with your actual domain
SUBSCRIPTION_ID=$(az account show --query id -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
```

---

## Step 1 – Resource Group

```bash
az group create \
  --name $RG \
  --location $LOCATION \
  --tags Application=$APP_NAME Environment=production
```

---

## Step 2 – Azure Container Registry

```bash
ACR_NAME="${APP_NAME}acr$(openssl rand -hex 4)"   # Must be globally unique
ACR_NAME="${APP_NAME}acr"                          # Adjust to ensure uniqueness

az acr create \
  --resource-group $RG \
  --name $ACR_NAME \
  --sku Premium \
  --admin-enabled false \
  --zone-redundancy Enabled \
  --tags Application=$APP_NAME

# Get the ACR login server
ACR_SERVER=$(az acr show --name $ACR_NAME --query loginServer -o tsv)
echo "ACR login server: $ACR_SERVER"

# Grant yourself push/pull access
CURRENT_USER=$(az ad signed-in-user show --query id -o tsv)
az role assignment create \
  --assignee $CURRENT_USER \
  --role AcrPush \
  --scope $(az acr show --name $ACR_NAME --query id -o tsv)
```

---

## Step 3 – Azure Database for PostgreSQL Flexible Server

### 3.1 Create the Server

```bash
DB_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)
DB_ADMIN="cybertabletop"

az postgres flexible-server create \
  --resource-group $RG \
  --name "${APP_NAME}-postgres" \
  --location $LOCATION \
  --admin-user $DB_ADMIN \
  --admin-password "${DB_PASSWORD}" \
  --sku-name Standard_D2s_v3 \
  --tier GeneralPurpose \
  --storage-size 128 \
  --version 16 \
  --high-availability ZoneRedundant \
  --zone 1 \
  --standby-zone 2 \
  --backup-retention 7 \
  --geo-redundant-backup Enabled \
  --public-access None \
  --tags Application=$APP_NAME

echo "DB password (save this — store in Key Vault next): $DB_PASSWORD"
```

### 3.2 Create the Application Database

```bash
az postgres flexible-server db create \
  --resource-group $RG \
  --server-name "${APP_NAME}-postgres" \
  --database-name cybertabletop
```

### 3.3 Configure Private Endpoint

```bash
# Create VNet for private endpoints
VNET_NAME="${APP_NAME}-vnet"
az network vnet create \
  --resource-group $RG \
  --name $VNET_NAME \
  --address-prefix 10.0.0.0/16 \
  --location $LOCATION

# App Service integration subnet
az network vnet subnet create \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name app-subnet \
  --address-prefix 10.0.1.0/24 \
  --delegations Microsoft.Web/serverFarms

# Private endpoint subnet
az network vnet subnet create \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name pe-subnet \
  --address-prefix 10.0.2.0/24 \
  --disable-private-endpoint-network-policies true

# Private endpoint for PostgreSQL
POSTGRES_ID=$(az postgres flexible-server show \
  --resource-group $RG \
  --name "${APP_NAME}-postgres" \
  --query id -o tsv)

az network private-endpoint create \
  --resource-group $RG \
  --name "${APP_NAME}-postgres-pe" \
  --vnet-name $VNET_NAME \
  --subnet pe-subnet \
  --private-connection-resource-id $POSTGRES_ID \
  --group-id postgresqlServer \
  --connection-name "${APP_NAME}-postgres-conn"
```

---

## Step 4 – Azure Cache for Redis

```bash
REDIS_PASSWORD=$(openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32)

az redis create \
  --resource-group $RG \
  --name "${APP_NAME}-redis" \
  --location $LOCATION \
  --sku Premium \
  --vm-size P1 \
  --enable-non-ssl-port false \
  --minimum-tls-version 1.2 \
  --tags Application=$APP_NAME

REDIS_HOST=$(az redis show \
  --resource-group $RG \
  --name "${APP_NAME}-redis" \
  --query hostName -o tsv)

REDIS_KEY=$(az redis list-keys \
  --resource-group $RG \
  --name "${APP_NAME}-redis" \
  --query primaryKey -o tsv)

echo "Redis host: $REDIS_HOST"
echo "Redis URL: rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0"

# Private endpoint for Redis
REDIS_ID=$(az redis show --resource-group $RG --name "${APP_NAME}-redis" --query id -o tsv)

az network private-endpoint create \
  --resource-group $RG \
  --name "${APP_NAME}-redis-pe" \
  --vnet-name $VNET_NAME \
  --subnet pe-subnet \
  --private-connection-resource-id $REDIS_ID \
  --group-id redisCache \
  --connection-name "${APP_NAME}-redis-conn"
```

---

## Step 5 – Build and Push Images to ACR

```bash
# Log in to ACR
az acr login --name $ACR_NAME

# Build and push backend
docker build -t "${ACR_SERVER}/${APP_NAME}/backend:latest" ./backend
docker push "${ACR_SERVER}/${APP_NAME}/backend:latest"

# Build and push frontend (pass API URL as build argument)
docker build \
  --build-arg REACT_APP_API_URL="https://${DOMAIN}/api" \
  -t "${ACR_SERVER}/${APP_NAME}/frontend:latest" \
  ./frontend
docker push "${ACR_SERVER}/${APP_NAME}/frontend:latest"

# Optionally use ACR Tasks for cloud builds (no local Docker required)
# az acr build --registry $ACR_NAME --image "${APP_NAME}/backend:latest" ./backend
# az acr build --registry $ACR_NAME --image "${APP_NAME}/frontend:latest" ./frontend
```

---

## Step 6 – App Service Plan and Web Apps

### 6.1 Create App Service Plan

```bash
az appservice plan create \
  --resource-group $RG \
  --name "${APP_NAME}-plan" \
  --location $LOCATION \
  --is-linux \
  --sku P2V3 \
  --number-of-workers 2 \
  --tags Application=$APP_NAME
```

### 6.2 Create Managed Identity for ACR Pull

```bash
az identity create \
  --resource-group $RG \
  --name "${APP_NAME}-app-identity"

IDENTITY_ID=$(az identity show --resource-group $RG --name "${APP_NAME}-app-identity" --query id -o tsv)
IDENTITY_PRINCIPAL=$(az identity show --resource-group $RG --name "${APP_NAME}-app-identity" --query principalId -o tsv)
ACR_ID=$(az acr show --name $ACR_NAME --query id -o tsv)

# Grant AcrPull to the managed identity
az role assignment create \
  --assignee $IDENTITY_PRINCIPAL \
  --role AcrPull \
  --scope $ACR_ID
```

### 6.3 Create Backend Web App

```bash
az webapp create \
  --resource-group $RG \
  --plan "${APP_NAME}-plan" \
  --name "${APP_NAME}-backend" \
  --deployment-container-image-name "${ACR_SERVER}/${APP_NAME}/backend:latest" \
  --assign-identity $IDENTITY_ID

# Configure container registry
az webapp config container set \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --docker-custom-image-name "${ACR_SERVER}/${APP_NAME}/backend:latest" \
  --docker-registry-server-url "https://${ACR_SERVER}"

# VNet integration (to reach private endpoints)
az webapp vnet-integration add \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --vnet $VNET_NAME \
  --subnet app-subnet

# Application settings (non-secret)
az webapp config appsettings set \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --settings \
    NODE_ENV=production \
    PORT=5000 \
    WEBSITES_PORT=5000
```

### 6.4 Create Frontend Web App

```bash
az webapp create \
  --resource-group $RG \
  --plan "${APP_NAME}-plan" \
  --name "${APP_NAME}-frontend" \
  --deployment-container-image-name "${ACR_SERVER}/${APP_NAME}/frontend:latest" \
  --assign-identity $IDENTITY_ID

az webapp config container set \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --docker-custom-image-name "${ACR_SERVER}/${APP_NAME}/frontend:latest" \
  --docker-registry-server-url "https://${ACR_SERVER}"

az webapp vnet-integration add \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --vnet $VNET_NAME \
  --subnet app-subnet

az webapp config appsettings set \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --settings \
    NODE_ENV=production \
    WEBSITES_PORT=3000
```

---

## Step 7 – Application Gateway with WAF

### 7.1 Create Public IP

```bash
az network public-ip create \
  --resource-group $RG \
  --name "${APP_NAME}-agw-pip" \
  --allocation-method Static \
  --sku Standard \
  --zone 1 2 3

AGW_PIP=$(az network public-ip show \
  --resource-group $RG \
  --name "${APP_NAME}-agw-pip" \
  --query ipAddress -o tsv)
echo "Application Gateway public IP: $AGW_PIP"
```

### 7.2 Create Application Gateway Subnet

```bash
az network vnet subnet create \
  --resource-group $RG \
  --vnet-name $VNET_NAME \
  --name agw-subnet \
  --address-prefix 10.0.3.0/24
```

### 7.3 Create WAF Policy

```bash
az network application-gateway waf-policy create \
  --resource-group $RG \
  --name "${APP_NAME}-waf-policy" \
  --location $LOCATION

# Enable OWASP 3.2 rule set
az network application-gateway waf-policy managed-rule rule-set add \
  --resource-group $RG \
  --policy-name "${APP_NAME}-waf-policy" \
  --type OWASP \
  --version 3.2

# Set WAF to Prevention mode
az network application-gateway waf-policy policy-setting update \
  --resource-group $RG \
  --policy-name "${APP_NAME}-waf-policy" \
  --mode Prevention \
  --state Enabled
```

### 7.4 Create Application Gateway

```bash
BACKEND_FQDN="${APP_NAME}-backend.azurewebsites.net"
FRONTEND_FQDN="${APP_NAME}-frontend.azurewebsites.net"

az network application-gateway create \
  --resource-group $RG \
  --name "${APP_NAME}-agw" \
  --location $LOCATION \
  --sku WAF_v2 \
  --capacity 2 \
  --vnet-name $VNET_NAME \
  --subnet agw-subnet \
  --public-ip-address "${APP_NAME}-agw-pip" \
  --http-settings-cookie-based-affinity Disabled \
  --http-settings-port 443 \
  --http-settings-protocol Https \
  --frontend-port 443 \
  --routing-rule-type PathBasedRouting \
  --waf-policy "${APP_NAME}-waf-policy" \
  --priority 100 \
  --servers $FRONTEND_FQDN \
  --tags Application=$APP_NAME

# Add backend pool and routing rule for /api/* → backend App Service
az network application-gateway address-pool create \
  --resource-group $RG \
  --gateway-name "${APP_NAME}-agw" \
  --name backend-pool \
  --servers $BACKEND_FQDN

az network application-gateway url-path-map create \
  --resource-group $RG \
  --gateway-name "${APP_NAME}-agw" \
  --name path-map \
  --paths '/api/*' \
  --address-pool backend-pool \
  --default-address-pool backend-pool \
  --http-settings appGatewayBackendHttpSettings \
  --default-http-settings appGatewayBackendHttpSettings
```

---

## Step 8 – Azure Key Vault for Secrets

### 8.1 Create Key Vault

```bash
KV_NAME="${APP_NAME}-kv-$(openssl rand -hex 4)"

az keyvault create \
  --resource-group $RG \
  --name $KV_NAME \
  --location $LOCATION \
  --sku premium \
  --enable-rbac-authorization true \
  --enable-soft-delete true \
  --retention-days 90 \
  --tags Application=$APP_NAME

KV_URI=$(az keyvault show --name $KV_NAME --query properties.vaultUri -o tsv)
echo "Key Vault URI: $KV_URI"
```

### 8.2 Grant Access to App Service Managed Identities

```bash
KV_ID=$(az keyvault show --name $KV_NAME --query id -o tsv)

# Grant Secrets User role to the managed identity used by both web apps
az role assignment create \
  --assignee $IDENTITY_PRINCIPAL \
  --role "Key Vault Secrets User" \
  --scope $KV_ID
```

### 8.3 Store Secrets

```bash
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 16)
DB_URL="postgresql://${DB_ADMIN}:${DB_PASSWORD}@${APP_NAME}-postgres.postgres.database.azure.com:5432/cybertabletop?sslmode=require"
REDIS_URL="rediss://:${REDIS_KEY}@${REDIS_HOST}:6380/0"

az keyvault secret set --vault-name $KV_NAME --name "DATABASE-URL"        --value "${DB_URL}"
az keyvault secret set --vault-name $KV_NAME --name "REDIS-URL"           --value "${REDIS_URL}"
az keyvault secret set --vault-name $KV_NAME --name "JWT-SECRET"          --value "${JWT_SECRET}"
az keyvault secret set --vault-name $KV_NAME --name "JWT-REFRESH-SECRET"  --value "${JWT_REFRESH_SECRET}"
az keyvault secret set --vault-name $KV_NAME --name "SESSION-SECRET"      --value "${SESSION_SECRET}"
az keyvault secret set --vault-name $KV_NAME --name "POSTGRES-PASSWORD"   --value "${DB_PASSWORD}"
az keyvault secret set --vault-name $KV_NAME --name "REDIS-PASSWORD"      --value "${REDIS_KEY}"
```

### 8.4 Reference Key Vault Secrets in App Settings

App Service can reference Key Vault secrets directly using the `@Microsoft.KeyVault(SecretUri=...)` syntax:

```bash
az webapp config appsettings set \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --settings \
    "DATABASE_URL=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/DATABASE-URL/)" \
    "REDIS_URL=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/REDIS-URL/)" \
    "JWT_SECRET=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/JWT-SECRET/)" \
    "JWT_REFRESH_SECRET=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/JWT-REFRESH-SECRET/)" \
    "SESSION_SECRET=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/SESSION-SECRET/)"
```

---

## Step 9 – Azure Monitor and Log Analytics

### 9.1 Create Log Analytics Workspace

```bash
WORKSPACE_NAME="${APP_NAME}-logs"

az monitor log-analytics workspace create \
  --resource-group $RG \
  --workspace-name $WORKSPACE_NAME \
  --location $LOCATION \
  --retention-time 30 \
  --sku PerGB2018 \
  --tags Application=$APP_NAME

WORKSPACE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RG \
  --workspace-name $WORKSPACE_NAME \
  --query customerId -o tsv)
WORKSPACE_KEY=$(az monitor log-analytics workspace get-shared-keys \
  --resource-group $RG \
  --workspace-name $WORKSPACE_NAME \
  --query primarySharedKey -o tsv)
```

### 9.2 Enable Diagnostic Settings

```bash
# Enable diagnostics for App Service (backend)
BACKEND_ID=$(az webapp show --resource-group $RG --name "${APP_NAME}-backend" --query id -o tsv)
WORKSPACE_RESOURCE_ID=$(az monitor log-analytics workspace show \
  --resource-group $RG --workspace-name $WORKSPACE_NAME --query id -o tsv)

az monitor diagnostic-settings create \
  --name "${APP_NAME}-backend-diag" \
  --resource $BACKEND_ID \
  --workspace $WORKSPACE_RESOURCE_ID \
  --logs '[
    {"category": "AppServiceHTTPLogs",     "enabled": true, "retentionPolicy": {"days": 30, "enabled": true}},
    {"category": "AppServiceConsoleLogs",  "enabled": true, "retentionPolicy": {"days": 30, "enabled": true}},
    {"category": "AppServiceAppLogs",      "enabled": true, "retentionPolicy": {"days": 30, "enabled": true}}
  ]' \
  --metrics '[{"category": "AllMetrics", "enabled": true, "retentionPolicy": {"days": 30, "enabled": true}}]'
```

### 9.3 Create Azure Dashboard and Alerts

```bash
# High HTTP 5xx error rate alert
az monitor metrics alert create \
  --resource-group $RG \
  --name "${APP_NAME}-high-5xx-errors" \
  --scopes $BACKEND_ID \
  --condition "count Http5xx > 10" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --description "High 5xx error rate on backend"

# High CPU alert
az monitor metrics alert create \
  --resource-group $RG \
  --name "${APP_NAME}-high-cpu" \
  --scopes $BACKEND_ID \
  --condition "avg CpuPercentage > 80" \
  --window-size 5m \
  --evaluation-frequency 1m \
  --severity 2 \
  --description "Backend CPU usage above 80%"
```

---

## Step 10 – Microsoft Sentinel (Optional)

Microsoft Sentinel provides advanced SIEM/SOAR capabilities ideal for security-focused workloads like CyberTabletop.

```bash
# Enable Sentinel on the Log Analytics workspace
az sentinel onboarding-state create \
  --resource-group $RG \
  --workspace-name $WORKSPACE_NAME \
  --name default

# Enable common data connectors
# Azure Activity
az sentinel data-connector create \
  --resource-group $RG \
  --workspace-name $WORKSPACE_NAME \
  --data-connector-id AzureActivity \
  --kind AzureActivity

# Enable built-in analytic rules (Azure portal recommended for bulk enable)
echo "Navigate to the Azure portal → Microsoft Sentinel → Analytics"
echo "→ 'Rule templates' to enable relevant detection rules."
echo ""
echo "Recommended rule categories for CyberTabletop:"
echo "  - Anomalous login attempts"
echo "  - Impossible travel"
echo "  - High volume of failed authentications"
echo "  - Privileged account activity"
```

---

## Step 11 – Microsoft Entra ID SSO Integration

CyberTabletop supports OpenID Connect (OIDC) for enterprise SSO. This step configures an Entra ID (Azure AD) App Registration and provides the exact `.env` values to enable it.

### 11.1 Create App Registration

```bash
# Create the app registration
APP_REG=$(az ad app create \
  --display-name "CyberTabletop" \
  --sign-in-audience AzureADMyOrg \
  --web-redirect-uris \
    "https://${DOMAIN}/api/auth/oidc/callback" \
    "https://${APP_NAME}-backend.azurewebsites.net/api/auth/oidc/callback" \
  --query "{appId:appId, objectId:id}" -o json)

APP_CLIENT_ID=$(echo $APP_REG | jq -r '.appId')
APP_OBJECT_ID=$(echo $APP_REG | jq -r '.objectId')

echo "Application (client) ID: $APP_CLIENT_ID"
echo "Object ID: $APP_OBJECT_ID"
```

### 11.2 Configure Optional Claims (return email, name, groups)

```bash
az ad app update \
  --id $APP_OBJECT_ID \
  --optional-claims '{
    "idToken": [
      {"name": "email",            "essential": false},
      {"name": "family_name",      "essential": false},
      {"name": "given_name",       "essential": false},
      {"name": "preferred_username","essential": false}
    ],
    "accessToken": [
      {"name": "email",            "essential": false}
    ]
  }'
```

### 11.3 Add Microsoft Graph API Permissions

```bash
# Get the Microsoft Graph service principal
GRAPH_SP=$(az ad sp list --filter "displayName eq 'Microsoft Graph'" --query '[0].appId' -o tsv)

# Add User.Read permission (delegated)
az ad app permission add \
  --id $APP_OBJECT_ID \
  --api $GRAPH_SP \
  --api-permissions e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope   # User.Read

# Grant admin consent (requires Global Admin or Application Administrator role)
az ad app permission admin-consent --id $APP_OBJECT_ID
```

### 11.4 Create Client Secret

```bash
SECRET_RESULT=$(az ad app credential reset \
  --id $APP_OBJECT_ID \
  --append \
  --display-name "CyberTabletop Production" \
  --end-date 2027-01-01 \
  --query "{clientSecret:password}" -o json)

APP_CLIENT_SECRET=$(echo $SECRET_RESULT | jq -r '.clientSecret')
echo "Client secret (save this — it will not be shown again): $APP_CLIENT_SECRET"
```

### 11.5 Create Service Principal

```bash
az ad sp create --id $APP_OBJECT_ID
```

### 11.6 .env Configuration Values

Set the following values in your `.env` file (or Key Vault) to enable Microsoft Entra ID SSO:

```dotenv
# ─── Microsoft Entra ID (Azure AD) SSO ───────────────────────────────────────
# Enable the OIDC SSO provider
OIDC_ENABLED=true

# The issuer URL for your tenant.
# Format: https://login.microsoftonline.com/<TENANT_ID>/v2.0
# Replace <TENANT_ID> with your Azure AD tenant ID.
OIDC_ISSUER=https://login.microsoftonline.com/<TENANT_ID>/v2.0

# The Application (client) ID from your App Registration (Step 11.1)
OIDC_CLIENT_ID=<APP_CLIENT_ID>

# The client secret generated in Step 11.4
OIDC_CLIENT_SECRET=<APP_CLIENT_SECRET>

# The callback URL registered in the App Registration.
# Must exactly match one of the Redirect URIs set in Step 11.1.
OIDC_CALLBACK_URL=https://<DOMAIN>/api/auth/oidc/callback

# OAuth2 scopes to request
OIDC_SCOPE=openid profile email

# Claim to use as the user's display name
OIDC_NAME_CLAIM=name

# Claim to use as the user's email address
OIDC_EMAIL_CLAIM=email

# Claim to use as the unique user identifier
OIDC_ID_CLAIM=oid

# Auto-provision new users on first SSO login (true/false)
OIDC_AUTO_PROVISION=true

# Default role assigned to auto-provisioned SSO users
OIDC_DEFAULT_ROLE=PLAYER
```

**Resolved values for your tenant** (fill in after completing the steps above):

| .env Key | Value | Where to Find |
|---|---|---|
| `OIDC_ISSUER` | `https://login.microsoftonline.com/{TENANT_ID}/v2.0` | Azure portal → Entra ID → Overview → Tenant ID |
| `OIDC_CLIENT_ID` | Output of Step 11.1 | Azure portal → App registrations → Application (client) ID |
| `OIDC_CLIENT_SECRET` | Output of Step 11.4 | Shown once during creation |
| `OIDC_CALLBACK_URL` | `https://yourdomain.com/api/auth/oidc/callback` | Must match Redirect URI in App Registration |

#### Store SSO secrets in Key Vault

```bash
az keyvault secret set --vault-name $KV_NAME \
  --name "OIDC-CLIENT-ID"     --value "${APP_CLIENT_ID}"
az keyvault secret set --vault-name $KV_NAME \
  --name "OIDC-CLIENT-SECRET" --value "${APP_CLIENT_SECRET}"

# Reference in App Service
az webapp config appsettings set \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --settings \
    OIDC_ENABLED=true \
    "OIDC_ISSUER=https://login.microsoftonline.com/${TENANT_ID}/v2.0" \
    "OIDC_CLIENT_ID=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/OIDC-CLIENT-ID/)" \
    "OIDC_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=${KV_URI}secrets/OIDC-CLIENT-SECRET/)" \
    "OIDC_CALLBACK_URL=https://${DOMAIN}/api/auth/oidc/callback" \
    OIDC_SCOPE="openid profile email" \
    OIDC_NAME_CLAIM=name \
    OIDC_EMAIL_CLAIM=email \
    OIDC_ID_CLAIM=oid \
    OIDC_AUTO_PROVISION=true \
    OIDC_DEFAULT_ROLE=PLAYER
```

### 11.7 Restrict Access to Specific Groups (Optional)

To restrict login to specific Entra ID groups:

1. In the Azure portal, go to **Enterprise Applications** → select your app → **Properties** → set **Assignment required** to **Yes**.
2. Under **Users and groups**, add the groups or users that should have access.
3. Only assigned users/groups will be able to authenticate.

---

## Environment Variable Mapping

The following table maps `.env` file variables to their Azure Key Vault secret names and how they are injected into App Service.

| .env Key | Key Vault Secret Name | App Service Reference |
|---|---|---|
| `DATABASE_URL` | `DATABASE-URL` | `@Microsoft.KeyVault(SecretUri=.../DATABASE-URL/)` |
| `REDIS_URL` | `REDIS-URL` | `@Microsoft.KeyVault(SecretUri=.../REDIS-URL/)` |
| `JWT_SECRET` | `JWT-SECRET` | `@Microsoft.KeyVault(SecretUri=.../JWT-SECRET/)` |
| `JWT_REFRESH_SECRET` | `JWT-REFRESH-SECRET` | `@Microsoft.KeyVault(SecretUri=.../JWT-REFRESH-SECRET/)` |
| `SESSION_SECRET` | `SESSION-SECRET` | `@Microsoft.KeyVault(SecretUri=.../SESSION-SECRET/)` |
| `POSTGRES_PASSWORD` | `POSTGRES-PASSWORD` | Embedded in `DATABASE_URL` |
| `REDIS_PASSWORD` | `REDIS-PASSWORD` | Embedded in `REDIS_URL` |
| `OIDC_CLIENT_ID` | `OIDC-CLIENT-ID` | `@Microsoft.KeyVault(SecretUri=.../OIDC-CLIENT-ID/)` |
| `OIDC_CLIENT_SECRET` | `OIDC-CLIENT-SECRET` | `@Microsoft.KeyVault(SecretUri=.../OIDC-CLIENT-SECRET/)` |

> Key Vault secret names use hyphens (`-`) because Azure Key Vault does not allow underscores in secret names.

---

## SSL/TLS with Azure-Managed Certificates

App Service provides free, automatically renewing TLS certificates for custom domains.

### Add Custom Domain

```bash
# First, create a CNAME record in your DNS pointing to the App Service default domain
# CNAME  yourdomain.com  →  cybertabletop-frontend.azurewebsites.net

# Add the custom domain to the frontend App Service
az webapp config hostname add \
  --resource-group $RG \
  --webapp-name "${APP_NAME}-frontend" \
  --hostname "${DOMAIN}"

# Create a free managed certificate
az webapp config ssl create \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --hostname "${DOMAIN}"

# Bind the certificate
CERT_THUMBPRINT=$(az webapp config ssl list \
  --resource-group $RG \
  --query "[?subjectName=='${DOMAIN}'].thumbprint" -o tsv)

az webapp config ssl bind \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --certificate-thumbprint $CERT_THUMBPRINT \
  --ssl-type SNI
```

### Force HTTPS

```bash
az webapp update \
  --resource-group $RG \
  --name "${APP_NAME}-frontend" \
  --https-only true

az webapp update \
  --resource-group $RG \
  --name "${APP_NAME}-backend" \
  --https-only true
```

---

## Auto-Scaling Configuration

### Configure App Service Auto-Scale Rules

```bash
PLAN_ID=$(az appservice plan show \
  --resource-group $RG \
  --name "${APP_NAME}-plan" \
  --query id -o tsv)

# Create auto-scale profile
az monitor autoscale create \
  --resource-group $RG \
  --resource $PLAN_ID \
  --resource-type Microsoft.Web/serverFarms \
  --name "${APP_NAME}-autoscale" \
  --min-count 2 \
  --max-count 10 \
  --count 2

# Scale out when CPU > 70% for 5 minutes
az monitor autoscale rule create \
  --resource-group $RG \
  --autoscale-name "${APP_NAME}-autoscale" \
  --condition "CpuPercentage > 70 avg 5m" \
  --scale out 2 \
  --cooldown 5

# Scale in when CPU < 30% for 10 minutes
az monitor autoscale rule create \
  --resource-group $RG \
  --autoscale-name "${APP_NAME}-autoscale" \
  --condition "CpuPercentage < 30 avg 10m" \
  --scale in 1 \
  --cooldown 10

# Scale out when memory > 80%
az monitor autoscale rule create \
  --resource-group $RG \
  --autoscale-name "${APP_NAME}-autoscale" \
  --condition "MemoryPercentage > 80 avg 5m" \
  --scale out 1 \
  --cooldown 5
```

---

## Estimated Monthly Cost

Estimated costs for a small deployment supporting up to 50 concurrent users in `East US`. All prices are in USD.

| Service | Configuration | Est. Monthly Cost |
|---|---|---|
| App Service Plan (P2V3) | 2 vCPU / 8 GB, 2 instances | ~$85 |
| Azure Database for PostgreSQL Flexible | Standard_D2s_v3, ZoneRedundant HA, 128 GB | ~$130 |
| Azure Cache for Redis | Premium P1 (6 GB) | ~$55 |
| Application Gateway v2 + WAF | Fixed + capacity units (low traffic) | ~$35 |
| Azure Container Registry | Premium tier | ~$21 |
| Azure Key Vault | Premium, < 10k operations/month | ~$5 |
| Azure DNS | 1 hosted zone + queries | ~$1 |
| Azure Front Door | Standard tier (optional) | ~$35 |
| Log Analytics Workspace | ~5 GB/day ingestion | ~$10–25 |
| Microsoft Sentinel | Optional, per-GB pricing | ~$0–50 |
| Bandwidth / egress | ~100 GB outbound | ~$8 |
| **Total (without Sentinel)** | | **~$385–$400/month** |
| **Total (with Sentinel)** | | **~$385–$450/month** |

> **Cost reduction tips:**
> - Use **Azure Hybrid Benefit** if you have existing Windows Server licenses.
> - Use **reserved instances** (1-year or 3-year) for App Service Plans and PostgreSQL to save up to 40%.
> - Switch to **Burstable tier** PostgreSQL (`Standard_B2s`) for non-production: ~$40/month.
> - Disable Zone-Redundant HA for non-production environments to halve the database cost.
> - Use **Dev/Test pricing** for non-production subscriptions.

---

## Post-Deployment Checklist

After completing the deployment, verify the following:

- [ ] Application loads at `https://yourdomain.com`
- [ ] HTTPS certificate is valid (no browser warnings)
- [ ] `/api/health` returns 200 OK
- [ ] Database migrations completed successfully. Current container images run Prisma migrations before API startup; verify backend startup logs show no pending or failed migrations.
- [ ] Seed data loaded: `npm run db:seed`
- [ ] First user registered and granted SUPER_ADMIN role
- [ ] SSO login works (if Entra ID configured)
- [ ] Application Gateway WAF is in Prevention mode
- [ ] Log Analytics is receiving logs
- [ ] Auto-scale rules are active
- [ ] Key Vault access policies verified
- [ ] Alert rules have been triggered and emails received
