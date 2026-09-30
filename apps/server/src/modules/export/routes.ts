import { isLocale } from "@wedding/shared";
import { Router } from "express";
import { requireRole } from "../../middleware/auth";
import { buildWorkbook } from "./workbook";

export const exportRouter = Router({ mergeParams: true });

exportRouter.get("/xlsx", requireRole("CO_PLANNER"), async (req, res) => {
  const wedding = req.wedding!;
  const locale = isLocale(req.query.lang) ? req.query.lang : req.user!.locale;
  const wb = await buildWorkbook(wedding, req.weddingRole!, locale);
  const filename = `wesele-${wedding.slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .set("Content-Disposition", `attachment; filename="${filename}"`)
    .set("Cache-Control", "no-store");
  await wb.xlsx.write(res);
  res.end();
});
