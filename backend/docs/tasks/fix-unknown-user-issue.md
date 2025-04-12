# Fix "Unknown User" Issue in Slack Messages

## Root Cause Analysis
The application is not creating SlackUser records when it processes messages from Slack. When it comes across a new user in a message, it should look up that user in Slack's API and create a corresponding record in our database, but this functionality is missing.

## Implementation Task List

1. **Modify the `_prepare_message_data` method in `app/services/slack/messages.py`**:
   - Enhance the user lookup logic around lines 421-432
   - If a user is not found in the database, add logic to fetch user details from Slack API
   - Create a new SlackUser record with the fetched details
   - Store the newly created user's ID in the message record

2. **Add a helper method to fetch user details from Slack API**:
   - Create a new method like `_fetch_user_from_api` in the SlackMessageService class
   - Use the SlackApiClient to make API calls to retrieve user info
   - Include error handling for API failures

3. **Handle potential rate limits and quota issues**:
   - Implement caching to avoid redundant user detail requests within a sync session
   - Add exponential backoff for rate-limit handling

4. **Add fallback for text-based user references**:
   - Parse message text for user mentions like `<@USER123>` 
   - Try to extract user IDs from these mentions when other methods fail

5. **Update unit tests**:
   - Add test cases for the new user creation functionality
   - Ensure the implementation properly handles error cases

6. **Add logging**:
   - Include detailed logging for user creation during message processing
   - Log stats about how many users were created/looked up during processing

## Benefits of This Approach
This approach will create user records only when needed (when we encounter them in messages), which is more efficient than syncing all users from a workspace.
