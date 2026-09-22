import { NextResponse } from "next/server";
export async function GET(){return NextResponse.json({error:"请刷新页面使用新版旅行入口"},{status:410});}
export const POST=GET;
