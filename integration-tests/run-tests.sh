set -e

echo "Starting integration tests..."

mkdir -p results
mkdir -p test-results

echo "Running API tests..."
cd tests/api
pytest -v --junitxml=../../results/api-results.xml

echo "Running E2E tests..."
cd ../e2e
npx playwright test --config=../../playwright.config.ts --reporter=junit,html
mv test-results/junit.xml ../../results/e2e-results.xml
mv test-results/html ../../results/e2e-report

echo "Starting HTML report server..."
cd ../..
npx playwright show-report results/e2e-report --port 9323 &

echo "All tests completed!"
echo "HTML report available at http://localhost:9323"
