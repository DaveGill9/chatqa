import Feedback from '../../components/feedback/Feedback';
import Page from '../../components/layout/Page';

export default function PersonalitiesPage() {
  return (
    <Page>
      <Page.Header
        title="Personalities"
        subtitle="Manage reusable writing styles for AI-generated test inputs."
      />
      <Page.Content>
        <Feedback type="empty" title="No personalities yet">
          Add your first personality in the next step of the rollout.
        </Feedback>
      </Page.Content>
    </Page>
  );
}
