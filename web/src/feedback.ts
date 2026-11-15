// Feedback goes to GitHub Issues: public, tracked, no backend of ours. The chooser offers the two issue forms in
// .github/ISSUE_TEMPLATE (test/feedback.test.ts keeps the link and the forms in step).
export const FEEDBACK_URL = 'https://github.com/zenntkaixa/radiozk/issues/new/choose';

const ASKED = 'radiozk.feedbackAsked';
const LIKES_BEFORE_ASKING = 3;

/** Whether this 👍 (the `likes`-th saved song) is the moment to ask, once ever per browser. Marks it as asked. */
export function shouldAskFeedback(likes: number): boolean {
  if (likes < LIKES_BEFORE_ASKING) return false;
  try {
    if (localStorage.getItem(ASKED)) return false;
    localStorage.setItem(ASKED, '1');
    return true;
  } catch {
    return false; // storage blocked: we could not remember it, so never nag
  }
}
