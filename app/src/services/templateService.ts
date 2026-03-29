import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { getAuthenticatedUserOrThrow } from '@/services/workoutService';
import type { Tables, TablesInsert } from '@/types/database';

export type WorkoutTemplateRow = Tables<'workout_templates'>;
export type TemplateExerciseRow = Tables<'template_exercises'>;
export type ExerciseRow = Tables<'exercises'>;

export type TemplateSummary = Pick<WorkoutTemplateRow, 'id' | 'name' | 'notes' | 'created_at'> & {
  exerciseCount: number;
  exerciseNames: string[];
};

export type TemplateDetailExercise = Pick<TemplateExerciseRow, 'id' | 'order_index' | 'rest_seconds'> & {
  exercise: ExerciseRow;
};

export type TemplateDetail = Pick<WorkoutTemplateRow, 'id' | 'user_id' | 'name' | 'notes' | 'created_at'> & {
  exercises: TemplateDetailExercise[];
};

type RawTemplateExerciseNameRow = Pick<TemplateExerciseRow, 'template_id' | 'order_index'> & {
  exercises?: Pick<ExerciseRow, 'name'> | Pick<ExerciseRow, 'name'>[] | null;
};

type RawTemplateExerciseDetailRow = Pick<TemplateExerciseRow, 'id' | 'order_index' | 'exercise_id' | 'rest_seconds'> & {
  exercises?: ExerciseRow | ExerciseRow[] | null;
};

type TemplateExercisePreloadPayloadItem = {
  exercise: ExerciseRow;
  restSeconds: number;
};

export type TemplateExerciseSaveInput = {
  exerciseId: string;
  restSeconds?: number | null;
};

function normalizeOptionalId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTemplateName(value: string): string {
  const normalized = value.trim();

  if (normalized.length < 2) {
    throw new Error('Template name must have at least 2 characters.');
  }

  if (normalized.length > 120) {
    throw new Error('Template name must be 120 characters or less.');
  }

  return normalized;
}

function normalizeTemplateRestSeconds(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 90;
  }

  const normalized = Math.trunc(value);
  return Math.max(15, Math.min(900, normalized));
}

function normalizeTemplateExerciseInputs(
  exercises: Array<string | TemplateExerciseSaveInput>
): Array<{ exerciseId: string; restSeconds: number }> {
  const result: Array<{ exerciseId: string; restSeconds: number }> = [];
  const seen = new Set<string>();

  for (const entry of exercises) {
    const rawExerciseId = typeof entry === 'string' ? entry : entry.exerciseId;
    const normalized = rawExerciseId.trim();

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push({
      exerciseId: normalized,
      restSeconds: normalizeTemplateRestSeconds(typeof entry === 'string' ? 90 : entry.restSeconds),
    });
  }

  return result;
}

function resolveEmbeddedObject<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

export async function getTemplates(): Promise<TemplateSummary[]> {
  const user = await getAuthenticatedUserOrThrow();

  const { data: templates, error: templatesError } = await supabase
    .from('workout_templates')
    .select('id, name, notes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (templatesError) {
    throw new Error(`Unable to load templates: ${templatesError.message}`);
  }

  if (!templates || templates.length === 0) {
    return [];
  }

  const templateIds = templates.map((template) => template.id);

  const { data: templateExercises, error: templateExercisesError } = await supabase
    .from('template_exercises')
    .select('template_id, order_index, exercises(name)')
    .in('template_id', templateIds)
    .order('order_index', { ascending: true });

  if (templateExercisesError) {
    throw new Error(`Unable to load template exercises: ${templateExercisesError.message}`);
  }

  const namesByTemplateId = new Map<string, string[]>();

  for (const relation of (templateExercises as RawTemplateExerciseNameRow[] | null) ?? []) {
    const exercise = resolveEmbeddedObject(relation.exercises);

    if (!exercise?.name) {
      continue;
    }

    const currentValue = namesByTemplateId.get(relation.template_id) ?? [];
    currentValue.push(exercise.name);
    namesByTemplateId.set(relation.template_id, currentValue);
  }

  return templates.map((template) => {
    const exerciseNames = namesByTemplateId.get(template.id) ?? [];

    return {
      id: template.id,
      name: template.name,
      notes: template.notes,
      created_at: template.created_at,
      exerciseCount: exerciseNames.length,
      exerciseNames,
    };
  });
}

export async function getTemplateById(templateId: string): Promise<TemplateDetail> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedTemplateId = normalizeOptionalId(templateId);

  if (!normalizedTemplateId) {
    throw new Error('Template id is required.');
  }

  const { data: template, error: templateError } = await supabase
    .from('workout_templates')
    .select('id, user_id, name, notes, created_at')
    .eq('id', normalizedTemplateId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (templateError) {
    throw new Error(`Unable to load template: ${templateError.message}`);
  }

  if (!template) {
    throw new Error('Template not found.');
  }

  const { data: templateExercises, error: templateExercisesError } = await supabase
    .from('template_exercises')
    .select('id, order_index, rest_seconds, exercise_id, exercises(*)')
    .eq('template_id', template.id)
    .order('order_index', { ascending: true });

  if (templateExercisesError) {
    throw new Error(`Unable to load template exercises: ${templateExercisesError.message}`);
  }

  const exercises: TemplateDetailExercise[] = [];

  for (const relation of (templateExercises as RawTemplateExerciseDetailRow[] | null) ?? []) {
    const exercise = resolveEmbeddedObject(relation.exercises);

    if (!exercise) {
      continue;
    }

    exercises.push({
      id: relation.id,
      order_index: relation.order_index,
      rest_seconds: normalizeTemplateRestSeconds(relation.rest_seconds),
      exercise,
    });
  }

  return {
    id: template.id,
    user_id: template.user_id,
    name: template.name,
    notes: template.notes,
    created_at: template.created_at,
    exercises,
  };
}

export async function saveTemplate(
  name: string,
  exercises: Array<string | TemplateExerciseSaveInput>
): Promise<TemplateDetail> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedName = normalizeTemplateName(name);
  const normalizedExercises = normalizeTemplateExerciseInputs(exercises);

  if (normalizedExercises.length === 0) {
    throw new Error('Select at least one exercise to save a template.');
  }

  const templateInsert: TablesInsert<'workout_templates'> = {
    user_id: user.id,
    name: normalizedName,
    notes: null,
  };

  const { data: createdTemplate, error: templateError } = await supabase
    .from('workout_templates')
    .insert(templateInsert)
    .select('id')
    .single();

  if (templateError || !createdTemplate) {
    throw new Error(`Unable to create template: ${templateError?.message ?? 'Unknown error'}`);
  }

  const templateExerciseRows: TablesInsert<'template_exercises'>[] = normalizedExercises.map((entry, index) => ({
    template_id: createdTemplate.id,
    exercise_id: entry.exerciseId,
    order_index: index + 1,
    rest_seconds: normalizeTemplateRestSeconds(entry.restSeconds),
  }));

  const { error: templateExercisesError } = await supabase.from('template_exercises').insert(templateExerciseRows);

  if (!templateExercisesError) {
    return getTemplateById(createdTemplate.id);
  }

  const { error: rollbackError } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', createdTemplate.id)
    .eq('user_id', user.id);

  if (rollbackError) {
    throw new Error(
      `Unable to save template exercises: ${templateExercisesError.message}. Rollback failed for template ${createdTemplate.id}: ${rollbackError.message}`
    );
  }

  throw new Error(
    `Unable to save template exercises: ${templateExercisesError.message}. Template ${createdTemplate.id} was rolled back successfully.`
  );
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const user = await getAuthenticatedUserOrThrow();
  const normalizedTemplateId = normalizeOptionalId(templateId);

  if (!normalizedTemplateId) {
    throw new Error('Template id is required.');
  }

  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', normalizedTemplateId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Unable to delete template: ${error.message}`);
  }
}

export async function startWorkoutFromTemplate(templateId: string): Promise<TemplateDetail> {
  const template = await getTemplateById(templateId);

  if (template.exercises.length === 0) {
    throw new Error('This template has no exercises.');
  }

  const serializedExercises = encodeURIComponent(
    JSON.stringify(
      template.exercises.map<TemplateExercisePreloadPayloadItem>((entry) => ({
        exercise: entry.exercise,
        restSeconds: normalizeTemplateRestSeconds(entry.rest_seconds),
      }))
    )
  );

  router.push({
    pathname: '/workout/active',
    params: {
      templateId: template.id,
      templateExercises: serializedExercises,
    },
  } as any);

  return template;
}
