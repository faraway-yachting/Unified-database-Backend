# Faraway Admin Backend

Express.js backend server with PostgreSQL database using Prisma ORM.

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Edit `.env` file with your database connection URL:
```
DATABASE_URL="postgresql://postgres:your_password@localhost:5432/faraway_admin?schema=public"
```

4. Create the PostgreSQL database:
```sql
CREATE DATABASE faraway_admin;
```

5. Generate Prisma Client:
```bash
npm run prisma:generate
```

6. (Optional) Run database migrations:
```bash
npm run prisma:migrate
```

Or push schema changes without migrations:
```bash
npm run prisma:push
```

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

The server will start on `http://localhost:3000` (or the port specified in your `.env` file).

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /api` - API information

## Project Structure

```
.
├── config/
│   └── database.js      # Prisma client configuration
├── prisma/
│   └── schema.prisma    # Prisma schema (database models)
├── routes/
│   └── index.js         # API routes
├── controllers/         # Request handlers (create as needed)
├── middleware/          # Custom middleware (create as needed)
├── server.js            # Main server file
├── package.json         # Dependencies and scripts
└── .env                 # Environment variables (not in git)
```

## Database Connection

The database connection uses Prisma ORM. The Prisma client is configured in `config/database.js` and automatically manages connection pooling. Database models are defined in `prisma/schema.prisma`.

### Prisma Commands

- `npm run prisma:generate` - Generate Prisma Client after schema changes
- `npm run prisma:migrate` - Create and apply database migrations
- `npm run prisma:push` - Push schema changes to database (dev only)
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## Development

- Uses `nodemon` for automatic server restart during development
- Logs queries and request information using `morgan`
- CORS enabled for cross-origin requests
- Prisma query logging enabled in development mode

### Working with Prisma

1. **Define models** in `prisma/schema.prisma`
2. **Generate Prisma Client**: `npm run prisma:generate`
3. **Create migrations**: `npm run prisma:migrate`
4. **Use Prisma Client** in your code:
   ```javascript
   const { prisma } = require('./config/database');
   
   // Example query
   const users = await prisma.user.findMany();
   ```

For more information, visit [Prisma Documentation](https://www.prisma.io/docs)
