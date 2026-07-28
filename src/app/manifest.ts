import type { MetadataRoute } from "next";
import { brand } from "@/config/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.description,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#fcfcfc",
    theme_color: "#fcfcfc",
    lang: "pt-BR",
    icons: [
      {
        src: brand.logos.icon,
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brand.logos.icon,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brand.logos.icon,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brand.logos.icon,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Hoje",
        short_name: "Hoje",
        url: "/dashboard",
        icons: [{ src: brand.logos.icon, sizes: "192x192" }],
      },
      {
        name: "Agenda",
        short_name: "Agenda",
        url: "/agenda",
        icons: [{ src: brand.logos.icon, sizes: "192x192" }],
      },
      {
        name: "Clientes",
        short_name: "Clientes",
        url: "/clientes",
        icons: [{ src: brand.logos.icon, sizes: "192x192" }],
      },
      {
        name: "Comandas",
        short_name: "Comandas",
        url: "/comandas",
        icons: [{ src: brand.logos.icon, sizes: "192x192" }],
      },
    ],
  };
}
