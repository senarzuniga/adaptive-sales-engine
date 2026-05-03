import { runOfferSystemSetup } from './setup-offer-system';

runOfferSystemSetup().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
