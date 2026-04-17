import { runDashboardTests } from "../src/lib/progress/dashboard.test";
import { runUtilsTests } from "../src/lib/progress/utils.test";

try {
  console.log("Running progress helper tests...");
  runUtilsTests();
  runDashboardTests();
  console.log("All progress helper tests passed.");
} catch (error) {
  console.error("Progress helper tests failed.");
  console.error(error);
  process.exit(1);
}
