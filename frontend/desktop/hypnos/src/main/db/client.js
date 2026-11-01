import { drizzle } from 'drizzle-orm/libsql'
import { createClient } from '@libsql/client'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import * as schema from './schema/schema.js'

let dbInstance = null

export function getDb() {
  if (dbInstance) return dbInstance

  const isDev = !app.isPackaged
  // EN DEV on utilise local.db
  // En PROD (app buildée) on utilse app data
  
  const dbPath = isDev ? path.join(process.cwd(), 'local.db') : path.join(app.getPath('userData'), 'hypnos.db')

  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  console.log('DB path:', dbPath)
  
  const libsqlClient = createClient({
    url: `file:${dbPath}`
  })
  dbInstance = drizzle(libsqlClient, { schema })

  console.log('DB connnecté à:', dbPath)
  return dbInstance
}