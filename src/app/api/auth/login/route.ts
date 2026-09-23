import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const SESSION_COOKIE = "crm_session";
const SESSION_VALUE = "authenticated";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pin } = body;

    if (!pin || pin !== process.env.CRM_PIN) {
      return NextResponse.json(
        { error: "Неверный PIN-код" },
        { status: 401 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, SESSION_VALUE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Ошибка сервера" },
      { status: 500 }
    );
  }
}
