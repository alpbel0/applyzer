import { z } from "zod";

import {
  emailDraftSchema,
  recommendationSchema,
  type EvaluationOutput,
} from "@/lib/schemas/evaluation";

export type DraftType = z.infer<typeof recommendationSchema>;
export type EmailDraft = z.infer<typeof emailDraftSchema>;

const forbiddenContent = [
  /\bskor\b/iu,
  /\bpuan(?:lama|ınız|ınızın)?\b/iu,
  /\brubric\b/iu,
  /\bkriter\s+puan/iu,
  /\brisk(?:ler|iniz)?\b/iu,
  /\byapay\s+zek[aâ]\b/iu,
  /\b(?:bir\s+)?(?:ai|llm)\s+(?:tarafından|ile)\b/iu,
];

export function buildEmailDraft(
  fullName: string,
  draftType: DraftType,
): EmailDraft {
  const name = fullName.trim() || "Merhaba";
  const drafts: Record<DraftType, EmailDraft> = {
    yes: {
      subject: "Staj Başvurunuz Hakkında",
      body: `${name} merhaba,\n\nKovan Startup Studio staj başvurunuz için teşekkür ederiz. Sizi daha yakından tanımak ve çalışmalarınız üzerine konuşmak için bir görüşmeye davet etmek istiyoruz. Önümüzdeki günlerde uygun olduğunuz tarih ve saat aralıklarını bizimle paylaşabilir misiniz?\n\nSevgiler,\nKovan Startup Studio`,
    },
    maybe: {
      subject: "Staj Başvurunuz Hakkında",
      body: `${name} merhaba,\n\nKovan Startup Studio staj başvurunuz için teşekkür ederiz. Başvurunuzla ilgili değerlendirme sürecimiz devam ediyor. Süreç tamamlandığında birkaç hafta içinde sizinle yeniden iletişime geçeceğiz.\n\nİlginiz ve ayırdığınız zaman için teşekkür ederiz.\n\nSevgiler,\nKovan Startup Studio`,
    },
    no: {
      subject: "Staj Başvurunuz Hakkında",
      body: `${name} merhaba,\n\nKovan Startup Studio staj programına gösterdiğiniz ilgi ve başvurunuz için teşekkür ederiz. Bu dönem için sürece birlikte devam edemeyeceğimizi üzülerek paylaşmak isteriz. İleride açılacak uygun pozisyonlarda başvurunuzu yeniden değerlendirmekten memnuniyet duyarız.\n\nÇalışmalarınızda başarılar dileriz.\n\nSevgiler,\nKovan Startup Studio`,
    },
  };
  return emailDraftSchema.parse(drafts[draftType]);
}

export function isEmailDraftSafe(draft: EmailDraft, draftType: DraftType) {
  const content = `${draft.subject}\n${draft.body}`;
  if (forbiddenContent.some((pattern) => pattern.test(content))) return false;
  if (draftType === "no") {
    return !/çünkü|nedeni|sebebi|yetersiz|eksik|uygun değil/iu.test(content);
  }
  return true;
}

export function selectInitialEmailDraft(input: {
  fullName: string;
  finalRecommendation: DraftType;
  evaluation: EvaluationOutput;
}) {
  const generated = emailDraftSchema.safeParse(input.evaluation.email_draft);
  if (
    input.evaluation.recommendation === input.finalRecommendation &&
    generated.success &&
    isEmailDraftSafe(generated.data, input.finalRecommendation)
  ) {
    return generated.data;
  }
  return buildEmailDraft(input.fullName, input.finalRecommendation);
}
