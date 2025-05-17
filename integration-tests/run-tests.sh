set -e

echo "Starting integration tests..."

mkdir -p results

echo "Running API tests..."
cd tests/api
pytest -v --junitxml=../../results/api-results.xml

echo "Running E2E tests..."
cd ../e2e
npx playwright test --config=../../playwright.config.ts --reporter=junit,html
mv test-results/junit.xml ../../results/e2e-results.xml
mv test-results/html ../../results/e2e-report

echo "All tests completed!"
