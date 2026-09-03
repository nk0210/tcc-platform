/**
 * Copilot Tools — registration
 *
 * Import this module once (from copilotAgentService.ts) to populate the
 * tool registry. Adding a new tool module later is: write the file, add one
 * line here — no other file needs to change (satisfies the "must not be
 * hard-coded around today's modules" extensibility requirement).
 */
import { registerTool } from "../copilotToolRegistry";
import { profileTools }      from "./profileTools";
import { tradeTools }        from "./tradeTools";
import { analyticsTools }    from "./analyticsTools";
import { journalTools }      from "./journalTools";
import { watchlistTools }    from "./watchlistTools";
import { riskTools }         from "./riskTools";
import { academyTools }      from "./academyTools";
import { notificationTools } from "./notificationTools";
import { memoryTools }       from "./memoryTools";
import { communityTools }    from "./communityTools";
import { copyTradingTools }  from "./copyTradingTools";

let registered = false;

export function registerAllCopilotTools(): void {
  if (registered) return;
  registered = true;

  for (const tool of [
    ...profileTools,
    ...tradeTools,
    ...analyticsTools,
    ...journalTools,
    ...watchlistTools,
    ...riskTools,
    ...academyTools,
    ...notificationTools,
    ...memoryTools,
    ...communityTools,
    ...copyTradingTools,
  ]) {
    registerTool(tool);
  }
}
