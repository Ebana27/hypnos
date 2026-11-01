import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/main/db/schema/schema.js',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: 'file:./local.db'
  }
})
