import * as diff from 'diff';
import fetch from 'node-fetch'; // If Node 18+, you can skip this and use global fetch
import util from 'util';

export default (app) => {
  app.on('pull_request_review_comment.created', async (context) => {
    try {
      const pr = context.payload.pull_request;
      const repo = context.payload.repository.name;
      const owner = context.payload.repository.owner.login;
      const filePath = context.payload.comment.path;

      const baseSha = pr.base.sha;
      const headSha = pr.head.sha;

      // Fetch old file content
      const oldFileResp = await context.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: baseSha,
      });
      const oldContent = Buffer.from(oldFileResp.data.content, 'base64').toString('utf8');

      // Fetch new file content
      const newFileResp = await context.octokit.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref: headSha,
      });
      const newContent = Buffer.from(newFileResp.data.content, 'base64').toString('utf8');

      // Generate diff
      const diffResult = diff.structuredPatch(
        filePath,
        filePath,
        oldContent,
        newContent,
        baseSha,
        headSha
      );

      const repoUrl = `https://github.com/${owner}/${repo}`;

      const finalOutput = {
        repository: repoUrl,
        file: filePath,
        baseCommit: baseSha,
        headCommit: headSha,
        diff: diffResult,
      };

      console.log('Sending payload to assistant:', util.inspect(finalOutput, { depth: null }));

      // POST JSON to your assistant API
      const response = await fetch('http://localhost:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalOutput),
      });

      if (!response.ok) {
        throw new Error(`Assistant API returned status ${response.status}`);
      }

      const responseBody = await response.text();

      console.log('Assistant API response:', responseBody);

      let formattedOutput;

      try {
        const parsed = JSON.parse(responseBody);
        formattedOutput = JSON.stringify(parsed, null, 2);
      } catch {
        formattedOutput = responseBody;
      }

      const commentBody = `### 🤖 Automated Code Review Result

      \`\`\`diff
      ${formattedOutput}
      \`\`\`
      `;


      // Post a reply comment to the triggering comment
      await context.octokit.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: pr.number,
        comment_id: context.payload.comment.id,
        body: responseBody,
      });

    } catch (error) {
      console.error('Error handling pull_request_review_comment:', error);
    }
  });
};
