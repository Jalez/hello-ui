import { useAppSelector } from "../../store/hooks/hooks";

export const InfoInstructions = () => {
  const { currentLevel } = useAppSelector((state) => state.currentLevel);
  const level = useAppSelector((state) => state.levels[currentLevel - 1]);
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        backgroundColor: "#1e1e1e",

        borderRadius: "1rem",
        boxShadow: "0 0 10px 0px rgba(0, 0, 0, 0.5)",
        width: "100%",
        height: "100%",
        overflow: "auto",
        margin: "1rem",
        zIndex: 10,
      }}
    >
      <header>
        <h2>Level Instructions</h2>
      </header>
      <p dangerouslySetInnerHTML={{ __html: level?.instructions || "" }} />
    </section>
  );
};
export default InfoInstructions;
