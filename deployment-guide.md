# Deployment Guide for Car Rental Management System

This guide provides step-by-step instructions for deploying the Car Rental Management System to your own server.

## Prerequisites

- Linux server (Ubuntu 20.04 LTS or newer recommended)
- Node.js 18 or newer
- PostgreSQL 14 or newer
- Nginx
- Domain name (optional)

## Server Setup

1. **Update system packages**:
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

2. **Install required software**:
   ```bash
   # Install Node.js 18.x
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install -y nodejs

   # Install PostgreSQL
   sudo apt install -y postgresql postgresql-contrib

   # Install Nginx
   sudo apt install -y nginx

   # Install PM2 for process management
   sudo npm install -g pm2
   ```

## Database Setup

1. **Create a PostgreSQL user and database**:
   ```bash
   sudo -u postgres psql
   ```

   In the PostgreSQL prompt:
   ```sql
   CREATE USER carrentaluser WITH PASSWORD 'secure_password_here';
   CREATE DATABASE carrentaldb OWNER carrentaluser;
   \q
   ```

2. **Test the database connection**:
   ```bash
   psql -U carrentaluser -d carrentaldb -h localhost
   # Enter your password when prompted
   # Type \q to exit
   ```

## Application Deployment

1. **Clone the repository**:
   ```bash
   git clone https://your-repository-url.git /var/www/carrentalmanager
   cd /var/www/carrentalmanager
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create .env file**:
   Copy the `.env.sample` file to `.env` and update the values:
   ```bash
   cp .env.sample .env
   nano .env
   ```

   Update the contents with your actual database credentials:
   ```
   DATABASE_URL=postgresql://carrentaluser:secure_password_here@localhost:5432/carrentaldb
   NODE_ENV=production
   SESSION_SECRET=random_secure_string_here
   ```

4. **Build the application**:
   ```bash
   npm run build
   ```

5. **Initialize database schema**:
   ```bash
   npm run db:push
   ```

6. **Configure PM2**:
   ```bash
   # Start the application with PM2
   pm2 start dist/index.js --name "car-rental-manager"

   # Configure PM2 to start on system boot
   pm2 startup
   # Follow the instructions output by the above command
   pm2 save
   ```

## Nginx Configuration

1. **Create Nginx server block**:
   ```bash
   sudo nano /etc/nginx/sites-available/car-rental-manager
   ```

   Add the following configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # Replace with your domain or server IP

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }

       # Configure file upload size limits
       client_max_body_size 50M;
   }
   ```

2. **Enable the site and restart Nginx**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/car-rental-manager /etc/nginx/sites-enabled/
   sudo nginx -t  # Test the configuration
   sudo systemctl restart nginx
   ```

## SSL Configuration (Optional)

1. **Install Certbot**:
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. **Obtain and install SSL certificate**:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

   Follow the prompts and choose to redirect HTTP traffic to HTTPS.

## File Upload Directory

Ensure the uploads directory exists and has proper permissions:

```bash
mkdir -p /var/www/carrentalmanager/uploads
chmod 755 /var/www/carrentalmanager/uploads
chown -R www-data:www-data /var/www/carrentalmanager/uploads
```

## Monitoring and Maintenance

1. **Check application status**:
   ```bash
   pm2 status
   ```

2. **View logs**:
   ```bash
   pm2 logs car-rental-manager
   ```

3. **Set up log rotation**:
   ```bash
   pm2 install pm2-logrotate
   ```

## Database Backups

1. **Create a backup script**:
   ```bash
   sudo nano /usr/local/bin/backup-carrentaldb.sh
   ```

   Add the following content:
   ```bash
   #!/bin/bash
   BACKUP_DIR="/var/backups/carrentaldb"
   TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
   mkdir -p $BACKUP_DIR
   pg_dump -U carrentaluser -d carrentaldb -h localhost > $BACKUP_DIR/carrentaldb_$TIMESTAMP.sql
   find $BACKUP_DIR -type f -mtime +7 -delete  # Delete backups older than 7 days
   ```

2. **Make the script executable**:
   ```bash
   sudo chmod +x /usr/local/bin/backup-carrentaldb.sh
   ```

3. **Set up a daily cron job**:
   ```bash
   sudo crontab -e
   ```

   Add this line:
   ```
   0 2 * * * /usr/local/bin/backup-carrentaldb.sh
   ```

## Updating the Application

1. **Pull latest changes**:
   ```bash
   cd /var/www/carrentalmanager
   git pull
   ```

2. **Rebuild and restart**:
   ```bash
   npm install
   npm run build
   pm2 restart car-rental-manager
   ```

## Troubleshooting

- **Check application logs**:
  ```bash
  pm2 logs car-rental-manager
  ```

- **Check Nginx logs**:
  ```bash
  sudo tail -f /var/log/nginx/error.log
  sudo tail -f /var/log/nginx/access.log
  ```

- **Check database connection**:
  ```bash
  psql -U carrentaluser -d carrentaldb -h localhost
  ```

- **Verify environment variables are loaded**:
  ```bash
  pm2 env car-rental-manager
  ```