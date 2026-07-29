// Cobrador de tarefas atribuídas a terceiros.
// Roda de hora em hora: para cada tarefa pendente com responsável, manda a
// cobrança no WhatsApp da pessoa e avisa o dono da conta. É o "serviço do chato"
// — o dono define prazo e meta uma vez, o Tuddo insiste.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

let _cachedMetaPhoneId: string | null = null;

async function getMetaPhoneId(supabase: any): Promise<string> {
  if (_cachedMetaPhoneId !== null) return _cachedMetaPhoneId;
  try {
    const { data } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "meta_phone_number_id")
      .single();
    if (data?.value) {
      _cachedMetaPhoneId = data.value;
      return data.value;
    }
  } catch { /* ignore */ }
  _cachedMetaPhoneId = "";
  return "";
}

async function sendMessage(phone: string, message: string, supabase: any): Promise<boolean> {
  const metaToken = Deno.env.get("META_ACCESS_TOKEN") ?? "";
  const metaPhoneId = await getMetaPhoneId(supabase);

  if (metaToken && metaPhoneId) {
    const res = await fetch(`https://graph.facebook.com/v23.0/${metaPhoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${metaToken}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
    });
    if (!res.ok) {
      console.error(`Meta send error to ${phone}:`, res.status, await res.text());
      return false;
    }
    return true;
  }

  const evolutionUrl = Deno.env.get("EVOLUTION_API_URL") ?? "";
  const instanceName = Deno.env.get("EVOLUTION_API_INSTANCE_NAME") ?? "";
  const evolutionKey = Deno.env.get("EVOLUTION_API_INSTANCE_TOKEN") ?? "";
  if (!evolutionUrl || !instanceName || !evolutionKey) {
    console.error("Nenhum canal de WhatsApp configurado");
    return false;
  }

  const res = await fetch(`${evolutionUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: evolutionKey },
    body: JSON.stringify({ number: phone, text: message }),
  });
  if (!res.ok) {
    console.error(`Evolution send error to ${phone}:`, res.status, await res.text());
    return false;
  }
  return true;
}

// Intervalo mínimo entre duas cobranças da MESMA tarefa, para não virar spam.
const CHARGE_COOLDOWN_HOURS = 20;
// Depois disso o Tuddo para de cobrar e devolve a bola para o dono.
const MAX_CHARGES = 4;

function advanceDueDate(dueDate: Date, recurrence: string): Date | null {
  const next = new Date(dueDate);
  switch (recurrence) {
    case "daily":
      next.setDate(next.getDate() + 1);
      return next;
    case "weekdays": {
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      return next;
    }
    case "weekly":
      next.setDate(next.getDate() + 7);
      return next;
    case "monthly":
      next.setMonth(next.getMonth() + 1);
      return next;
    default:
      return null;
  }
}

function formatDeadline(dueDate: Date): string {
  return dueDate.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildChargeMessage(
  ownerName: string,
  taskTitle: string,
  assigneeName: string,
  dueDate: Date,
  chargeCount: number,
  isOverdue: boolean,
): string {
  const greeting = assigneeName ? `Oi, ${assigneeName.split(" ")[0]}!` : "Oi!";
  const from = ownerName ? ` do(a) ${ownerName.split(" ")[0]}` : "";
  const prazo = formatDeadline(dueDate);

  if (chargeCount === 0) {
    return `${greeting} 👋\n\nSou o Tuddo, assistente${from}. Passando para lembrar de uma coisa:\n\n📌 *${taskTitle}*\n🗓️ Prazo: ${prazo}\n\nQuando terminar, é só me responder *"feito"* que eu dou baixa e aviso quem pediu. 😉`;
  }

  if (!isOverdue) {
    return `${greeting}\n\nSó reforçando o combinado: 📌\n\n*${taskTitle}*\n🗓️ Prazo: ${prazo}\n\nResponde *"feito"* quando concluir. 👍`;
  }

  if (chargeCount === 1) {
    return `${greeting}\n\nO prazo desta tarefa passou: ⏰\n\n📌 *${taskTitle}*\n🗓️ Era para ${prazo}\n\nConsegue resolver hoje? Se já fez, me responde *"feito"*.`;
  }

  return `${greeting}\n\nEsta é a ${chargeCount + 1}ª vez que eu passo aqui: 😅\n\n📌 *${taskTitle}*\n🗓️ Vencida desde ${prazo}\n\nMe responde *"feito"* se concluiu, ou avisa${from} se travou em alguma coisa.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const cronSecretHeader = req.headers.get("x-cron-secret");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const cronSecret = Deno.env.get("CRON_SECRET");
  const token = authHeader?.replace("Bearer ", "");

  const isAuthorized =
    (token && serviceRoleKey && token === serviceRoleKey) ||
    (cronSecret && cronSecretHeader === cronSecret);

  if (!isAuthorized) {
    console.error("Unauthorized call to chase-tasks");
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const now = new Date();
    const cooldownCutoff = new Date(now.getTime() - CHARGE_COOLDOWN_HOURS * 60 * 60 * 1000);

    const { data: tasks, error } = await supabase
      .from("tasks")
      .select("id, user_id, title, due_date, assignee_name, assignee_phone, recurrence, last_charged_at, charge_count")
      .eq("status", "pendente")
      .not("assignee_phone", "is", null)
      .lte("due_date", now.toISOString())
      .lt("charge_count", MAX_CHARGES)
      .limit(500);

    if (error) {
      console.error("Error fetching tasks:", error);
      return new Response(JSON.stringify({ error: "fetch_tasks_failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ status: "nothing_to_chase" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ownerCache = new Map<string, { full_name: string; phone: string }>();
    let charged = 0;

    for (const task of tasks) {
      // Cooldown: não cobrar a mesma tarefa duas vezes no mesmo dia
      if (task.last_charged_at && new Date(task.last_charged_at) > cooldownCutoff) continue;

      let owner = ownerCache.get(task.user_id);
      if (!owner) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", task.user_id)
          .single();
        owner = { full_name: profile?.full_name ?? "", phone: profile?.phone ?? "" };
        ownerCache.set(task.user_id, owner);
      }

      const dueDate = new Date(task.due_date);
      const isOverdue = dueDate.getTime() < now.getTime() - 60 * 60 * 1000;
      const message = buildChargeMessage(
        owner.full_name,
        task.title,
        task.assignee_name ?? "",
        dueDate,
        task.charge_count ?? 0,
        isOverdue,
      );

      const ok = await sendMessage(task.assignee_phone, message, supabase);
      if (!ok) continue;

      const nextChargeCount = (task.charge_count ?? 0) + 1;
      const update: Record<string, unknown> = {
        last_charged_at: now.toISOString(),
        charge_count: nextChargeCount,
      };

      // Tarefa recorrente: em vez de esgotar as cobranças, reagenda o próximo ciclo
      if (task.recurrence) {
        const next = advanceDueDate(dueDate, task.recurrence);
        if (next && next.getTime() > now.getTime()) {
          update.due_date = next.toISOString();
          update.charge_count = 0;
        }
      }

      await supabase.from("tasks").update(update).eq("id", task.id);
      charged++;

      // Na última cobrança, devolve a bola para quem pediu
      if (!task.recurrence && nextChargeCount >= MAX_CHARGES && owner.phone) {
        await sendMessage(
          owner.phone,
          `Aviso: já cobrei *${task.assignee_name || "o responsável"}* ${MAX_CHARGES}x sobre "${task.title}" e segue pendente. 🔔\n\nVou parar de insistir — se quiser, fala direto com a pessoa ou me pede para remarcar o prazo.`,
          supabase,
        );
      }
    }

    return new Response(JSON.stringify({ status: "ok", charged }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("chase-tasks error:", error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
