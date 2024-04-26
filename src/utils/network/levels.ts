import { Level } from "../../types";

const url = "http://localhost:3000/levels";

type getLevelNames = () => Promise<string[]>;
type getLevelById = (id: string) => Promise<Level>;
type updateLevel = (id: string, level: any) => Promise<Level>;
type deleteLevel = (id: string) => Promise<Level>;
type getAllLevels = () => Promise<Level[]>;
type createLevel = (level: any) => Promise<Level>;

export const getLevelNames = async () => {
  try {
    const response = await fetch(`${url}/names`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const getLevelById = async (id: string) => {
  try {
    const response = await fetch(`${url}/${id}`);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const updateLevel = async (id: string, level: any) => {
  try {
    const response = await fetch(`${url}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(level),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const deleteLevel = async (id: string) => {
  try {
    const response = await fetch(`${url}/${id}`, {
      method: "DELETE",
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const getAllLevels = async () => {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};

export const createLevel = async (level: any) => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(level),
    });
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error:", error);
  }
};
