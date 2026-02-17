import { z } from 'zod';

const microsecondSchema = z.number().int().nonnegative();
const confidenceSchema = z.number().min(0).max(1);

const transcriptWordSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    normalized: z.string().optional(),
    startUs: microsecondSchema,
    endUs: microsecondSchema,
    confidence: confidenceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endUs <= value.startUs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'word.endUs must be greater than word.startUs',
        path: ['endUs'],
      });
    }
  });

const transcriptSegmentSchema = z
  .object({
    id: z.string().min(1),
    startUs: microsecondSchema,
    endUs: microsecondSchema,
    text: z.string().min(1),
    wordIds: z.array(z.string().min(1)).default([]),
    confidence: confidenceSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endUs <= value.startUs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'segment.endUs must be greater than segment.startUs',
        path: ['endUs'],
      });
    }
  });

const canonicalTranscriptSchema = z
  .object({
    transcriptId: z.string().min(1),
    projectId: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    mode: z.string().min(1),
    language: z.string().min(1),
    source: z.object({
      path: z.string().min(1),
      ref: z.string().min(1),
      durationUs: microsecondSchema,
    }),
    adapter: z.object({
      kind: z.string().min(1),
      runtime: z.string().min(1),
      binary: z.string().optional(),
      model: z.string().min(1),
      engine: z.string().min(1),
    }),
    words: z.array(transcriptWordSchema),
    segments: z.array(transcriptSegmentSchema),
    wordCount: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.wordCount !== value.words.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `wordCount (${value.wordCount}) does not match words.length (${value.words.length})`,
        path: ['wordCount'],
      });
    }

    const wordIds = new Set(value.words.map((word) => word.id));
    for (let index = 0; index < value.segments.length; index += 1) {
      const segment = value.segments[index];
      for (const wordId of segment.wordIds || []) {
        if (!wordIds.has(wordId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `segment references unknown word id: ${wordId}`,
            path: ['segments', index, 'wordIds'],
          });
          break;
        }
      }
    }
  });

const cutRangeSchema = z
  .object({
    startUs: microsecondSchema,
    endUs: microsecondSchema,
    reason: z.string().min(1),
    confidence: confidenceSchema,
  })
  .superRefine((value, ctx) => {
    if (value.endUs <= value.startUs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'remove_range.endUs must be greater than remove_range.startUs',
        path: ['endUs'],
      });
    }
  });

const cutPlanSchema = z.object({
  planId: z.string().min(1),
  projectId: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  mode: z.string().min(1),
  fallbackPolicy: z.string().min(1),
  sourceRef: z.string().min(1),
  planner: z.object({
    model: z.string().min(1),
    strategy: z.string().min(1),
  }),
  analysis: z
    .object({
      silenceRangeCount: z.number().int().nonnegative(),
      fillerWordCount: z.number().int().nonnegative(),
      repetitionCount: z.number().int().nonnegative(),
    })
    .optional(),
  removeRanges: z.array(cutRangeSchema),
  rationale: z.array(
    z.object({
      startUs: microsecondSchema,
      endUs: microsecondSchema,
      reason: z.string().min(1),
      confidence: confidenceSchema,
    }),
  ),
});

const templateContentSchema = z.object({
  headline: z.string().min(1).max(140),
  subline: z.string().min(1).max(220),
});

const templatePlacementSchema = z
  .object({
    id: z.string().min(1),
    templateId: z.string().min(1),
    templateName: z.string().optional(),
    category: z.string().min(1),
    startUs: microsecondSchema,
    endUs: microsecondSchema,
    confidence: confidenceSchema,
    content: templateContentSchema,
    constraints: z
      .object({
        minDurationUs: microsecondSchema.optional(),
        maxDurationUs: microsecondSchema.optional(),
        minGapUs: microsecondSchema.optional(),
        maxHeadlineWords: z.number().int().positive().optional(),
        maxSublineChars: z.number().int().positive().optional(),
      })
      .partial()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endUs <= value.startUs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'template.endUs must be greater than template.startUs',
        path: ['endUs'],
      });
    }
  });

const assetSuggestionSchema = z
  .object({
    id: z.string().min(1),
    provider: z.string().min(1),
    kind: z.enum(['image', 'video']),
    query: z.string().min(1),
    startUs: microsecondSchema,
    endUs: microsecondSchema,
    effects: z.record(z.any()).optional(),
    attribution: z.any().optional(),
    media: z
      .object({
        status: z.string().min(1),
        localPath: z.string().optional(),
        attribution: z.any().nullable().optional(),
        license: z.string().optional(),
        providerAssetId: z.string().optional(),
        error: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.endUs <= value.startUs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'asset.endUs must be greater than asset.startUs',
        path: ['endUs'],
      });
    }
  });

const templatePlanSchema = z
  .object({
    planId: z.string().min(1),
    projectId: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    templateCount: z.number().int().nonnegative(),
    assetCount: z.number().int().nonnegative(),
    fetchExternal: z.boolean(),
    fallbackPolicy: z.string().min(1),
    planner: z.object({
      model: z.string().min(1),
      strategy: z.string().min(1),
    }),
    templatePlacements: z.array(templatePlacementSchema),
    assetSuggestions: z.array(assetSuggestionSchema),
  })
  .passthrough()
  .superRefine((value, ctx) => {
    if (value.templateCount !== value.templatePlacements.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `templateCount (${value.templateCount}) does not match templatePlacements.length (${value.templatePlacements.length})`,
        path: ['templateCount'],
      });
    }
    if (value.assetCount !== value.assetSuggestions.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `assetCount (${value.assetCount}) does not match assetSuggestions.length (${value.assetSuggestions.length})`,
        path: ['assetCount'],
      });
    }
  });

function zodIssuesToString(issues) {
  return issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}

function parseOrThrow(schema, payload, label) {
  const result = schema.safeParse(payload);
  if (result.success) {
    return result.data;
  }
  throw new Error(`${label} validation failed: ${zodIssuesToString(result.error.issues)}`);
}

function ensureRangesWithinDuration(ranges, durationUs, label) {
  if (!Number.isFinite(durationUs) || durationUs <= 0) {
    return ranges;
  }
  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    if (range.startUs > durationUs || range.endUs > durationUs) {
      throw new Error(
        `${label} validation failed: range at index ${index} exceeds duration (${durationUs}).`,
      );
    }
  }
  return ranges;
}

export function validateCanonicalTranscript(payload) {
  return parseOrThrow(canonicalTranscriptSchema, payload, 'canonical_transcript');
}

export function validateCutRanges(payload, durationUs = 0) {
  const parsed = parseOrThrow(z.array(cutRangeSchema), payload, 'cut_ranges');
  return ensureRangesWithinDuration(parsed, durationUs, 'cut_ranges');
}

export function validateCutPlan(payload, durationUs = 0) {
  const parsed = parseOrThrow(cutPlanSchema, payload, 'cut_plan');
  ensureRangesWithinDuration(parsed.removeRanges, durationUs, 'cut_plan.removeRanges');
  ensureRangesWithinDuration(parsed.rationale, durationUs, 'cut_plan.rationale');
  return parsed;
}

export function validateTemplatePlacements(payload, durationUs = 0) {
  const parsed = parseOrThrow(z.array(templatePlacementSchema), payload, 'template_placements');
  return ensureRangesWithinDuration(parsed, durationUs, 'template_placements');
}

export function validateAssetSuggestions(payload, durationUs = 0) {
  const parsed = parseOrThrow(z.array(assetSuggestionSchema), payload, 'asset_suggestions');
  return ensureRangesWithinDuration(parsed, durationUs, 'asset_suggestions');
}

export function validateTemplatePlan(payload, durationUs = 0) {
  const parsed = parseOrThrow(templatePlanSchema, payload, 'template_plan');
  ensureRangesWithinDuration(parsed.templatePlacements, durationUs, 'template_plan.templatePlacements');
  ensureRangesWithinDuration(parsed.assetSuggestions, durationUs, 'template_plan.assetSuggestions');
  return parsed;
}

// Agent Schemas
const editActionSchema = z.object({
  action: z.enum(['cut', 'keep', 'insert_image', 'speed_up', 'slow_down', 'add_text_overlay']),
  parameters: z.object({
    startUs: microsecondSchema.optional(),
    endUs: microsecondSchema.optional(),
    text: z.string().optional(),
    imageQuery: z.string().optional(),
    speedFactor: z.number().optional(),
    reason: z.string().optional(),
  }).passthrough(),
});

const agentStateSchema = z.object({
  projectId: z.string(),
  iteration: z.number().int().nonnegative(),
  history: z.array(z.object({
    action: editActionSchema,
    result: z.string(),
    timestamp: z.string().datetime()
  })),
  currentGoals: z.array(z.string()),
  transcriptSummary: z.string().optional(),
});

export function validateEditAction(payload) {
  return parseOrThrow(editActionSchema, payload, 'edit_action');
}

export function validateAgentState(payload) {
  return parseOrThrow(agentStateSchema, payload, 'agent_state');
}

export const schemas = {
  canonicalTranscriptSchema,
  cutRangeSchema,
  cutPlanSchema,
  templatePlacementSchema,
  assetSuggestionSchema,
  templatePlanSchema,
  editActionSchema,
  agentStateSchema,
};
