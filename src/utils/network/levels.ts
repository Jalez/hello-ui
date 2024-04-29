import { levelUrl } from "../../constants";
import { Level } from "../../types";
import { makeRequest } from "./makeRequest";

type getLevelNames = () => Promise<string[]>;
type getLevelById = (id: string) => Promise<Level>;
type updateLevel = (id: string, level: any) => Promise<Level>;
type deleteLevel = (id: string) => Promise<Level>;
type getAllLevels = () => Promise<Level[]>;
type createLevel = (level: any) => Promise<Level>;

export const getLevelNames: getLevelNames = async () => {
  const url = `${levelUrl}/names`;
  const data = makeRequest<string[]>(url);
  return data;
};

export const getLevelById: getLevelById = async (id: string) => {
  const url = `${levelUrl}/${id}`;
  const data = makeRequest<Level>(url);
  return data;
};

export const updateLevel: updateLevel = async (id, level) => {
  const options: RequestInit = {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(level),
  };
  const data = makeRequest<Level>(`${levelUrl}/${id}`, options);
  return data;
};

export const deleteLevel: deleteLevel = async (id) => {
  const options: RequestInit = {
    method: "DELETE",
  };
  const data = makeRequest<Level>(`${levelUrl}/${id}`, options);
  return data;
};

export const getAllLevels: getAllLevels = async () => {
  const data = makeRequest<Level[]>(levelUrl);
  return data;
};

export const createLevel: createLevel = async (level) => {
  const options: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(level),
  };
  const data = makeRequest<Level>(levelUrl, options);
  return data;
};
