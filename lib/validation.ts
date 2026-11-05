import { z } from "zod";
export const paperInput=z.object({title:z.string().min(10).max(300),abstract:z.string().min(40).max(12000),year:z.coerce.number().int().min(1950).max(new Date().getFullYear()+1),venue:z.string().min(2).max(160),doi:z.string().max(200).optional(),topics:z.array(z.string().min(2).max(60)).min(1).max(8)});
