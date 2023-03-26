export type ApiItemConfig = {
  name: string;
  spec: string;
  include?: string[];
  exclude?: string[];
};

export type ApiConfig = {
  items: ApiItemConfig[];
};
