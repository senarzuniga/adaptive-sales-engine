from .models import Action, Feedback, Scoring, EntityType, ActionType, ActionStatus, FeedbackType
from typing import List, Dict, Any

class ACSSupportSystem:
    def __init__(self):
        self.actions: List[Action] = []
        self.entities: Dict[str, Dict[str, Any]] = {}  # entity_id -> entity data

    def create_action(self, title, description, assigned_to, entity_type, entity_id, action_type, priority, context):
        action = Action(
            name=title,
            description=description,
            assigned_to=assigned_to,
            department=entity_type,
            status="open",
            importance_score=priority,
            context=context
        )
        self.actions.append(action)
        return action

    def add_feedback(self, action_id, user, feedback_type, comments):
        action = next((a for a in self.actions if a.id == action_id), None)
        if action:
            feedback = Feedback(action_id, user, feedback_type, comments)
            action.add_feedback(feedback)
            # Loop: if feedback is not positive, create a new action or escalate
            if feedback_type != FeedbackType.POSITIVE:
                self.create_action(
                    title=f"Revisión de acción: {action.title}",
                    description="Acción reabierta por feedback no positivo.",
                    assigned_to=action.assigned_to,
                    entity_type=action.entity_type,
                    entity_id=action.entity_id,
                    action_type=ActionType.TASK,
                    priority=action.priority + 1,
                    context={"reason": "feedback_loop", "original_action": action.id}
                )
        return action

    def get_open_actions(self, assigned_to=None):
        return [a for a in self.actions if a.status != ActionStatus.CLOSED and (assigned_to is None or a.assigned_to == assigned_to)]

    def close_action(self, action_id):
        action = next((a for a in self.actions if a.id == action_id), None)
        if action:
            action.status = ActionStatus.CLOSED
        return action
