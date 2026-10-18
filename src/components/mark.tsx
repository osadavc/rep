export function Mark({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#fff",
        color: "#000",
        fontSize: size * 0.34,
        fontWeight: 700,
        letterSpacing: -size * 0.016,
        paddingBottom: size * 0.04,
      }}
    >
      rep
    </div>
  );
}
