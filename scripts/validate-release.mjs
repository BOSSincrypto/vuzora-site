import { validateRelease } from "./release-validator.mjs";

try {
  const { routes } = await validateRelease();
  console.log(
    `Release validation passed for ${routes.length} registry-derived routes and required Pages artifacts.`,
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
