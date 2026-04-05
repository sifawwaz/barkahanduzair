export async function POST(req) {
  try {
    const { password } = await req.json();

    if (password === process.env.ADMIN_PASSWORD) {
      return Response.json({ success: true });
    }

    return Response.json({ success: false }, { status: 401 });
  } catch {
    return Response.json({ success: false }, { status: 500 });
  }
}
