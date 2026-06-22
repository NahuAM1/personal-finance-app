// Re-exports so hooks/use-services.ts can use `import * as servicesApi` cleanly
// while the canonical implementations live in lib/database-api.ts.
export {
  getServices,
  createService,
  updateService,
  deleteService,
  getServiceTransactions,
  payService,
  generateAutomaticServiceTransactions,
} from '@/lib/database-api'
