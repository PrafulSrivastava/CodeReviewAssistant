import * as diff from 'diff';
import fetch from 'node-fetch'; // Remove if using Node 18+ with global fetch
import util from 'util';

export default (app) => {
  app.on('pull_request_review_comment.created', async (context) => {
    try {
      if (context.payload.comment.user.type === 'Bot') {
        console.log('Skipping comment from a bot user to avoid infinite loop.');
        return;
      }

      const pr = context.payload.pull_request;
      const repo = context.payload.repository.name;
      const owner = context.payload.repository.owner.login;
      const filePath = context.payload.comment.path;

      const baseSha = pr.base.sha;
      const headSha = pr.head.sha;

      // Get the line number of the comment on the new file side
      const commentLine = context.payload.comment.line;
      if (!commentLine) {
        throw new Error('Comment line number not found in payload');
      }

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

      // Find the hunk containing the comment line
      const targetHunk = diffResult.hunks.find(hunk => {
        const start = hunk.newStart;
        const end = hunk.newStart + hunk.newLines - 1;
        return commentLine >= start && commentLine <= end;
      });

      if (!targetHunk) {
        throw new Error(`No hunk found containing comment line ${commentLine}`);
      }

      const hunkIndex = diffResult.hunks.indexOf(targetHunk);

      const hunkPayload = {
        repository: repoUrl,
        file: filePath,
        baseCommit: baseSha,
        headCommit: headSha,
        diff: {
          ...diffResult,
          hunks: [targetHunk],
        },
        hunkIndex,
        totalHunks: diffResult.hunks.length,
      };

      console.log(`Sending hunk ${hunkIndex + 1}th of ${diffResult.hunks.length} to assistant:`);
      console.log(util.inspect(hunkPayload, { depth: null }));

      // Helper to extract markdown from LLM JSON response
      function extractMarkdown(jsonString) {
        const parsed = JSON.parse(jsonString);
        return parsed.response
          .replace(/^```markdown\s*/, '')
          .replace(/```$/, '')
          .trim();
      }

      // One LLM call for the chosen hunk
      const response = await fetch('http://assistant:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hunkPayload),
      });

      if (!response.ok) {
        throw new Error(`Assistant API returned status ${response.status}`);
      }

      const llmRawResponse = await response.text();
      const prettyMarkdown = extractMarkdown(llmRawResponse);

      // Reply to the incoming review comment
      await context.octokit.pulls.createReplyForReviewComment({
        owner,
        repo,
        pull_number: pr.number,
        comment_id: context.payload.comment.id, // reply to this comment
        body: prettyMarkdown,
      });

      console.log(`Posted assistant reply to comment ID ${context.payload.comment.id}`);

    } catch (error) {
      console.error('Error handling pull_request_review_comment:', error);
    }
  });
};
