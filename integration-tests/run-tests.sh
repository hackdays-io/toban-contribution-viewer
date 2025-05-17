set -e

echo "Starting integration tests..."

mkdir -p results
mkdir -p test-results

echo "Running API tests..."
cd tests/api
pytest -v --junitxml=../../results/api-results.xml
cd ../..

echo "Running E2E tests..."
cd tests/e2e
npx playwright test --config=../../playwright.config.ts --reporter=junit,html

mkdir -p ../../results/e2e-report

if [ -d "test-results/html" ]; then
  echo "Copying HTML report from test-results/html to results/e2e-report..."
  cp -r test-results/html/* ../../results/e2e-report/
else
  echo "Warning: test-results/html directory not found"
  find . -name "*.html" | grep -v node_modules
fi

if [ -f "test-results/junit.xml" ]; then
  echo "Copying JUnit report to results/e2e-results.xml..."
  cp test-results/junit.xml ../../results/e2e-results.xml
else
  echo "Warning: test-results/junit.xml not found"
fi

cd ../..
echo "All tests completed!"
echo "HTML report saved to results/e2e-report/"
