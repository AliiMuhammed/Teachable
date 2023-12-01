import { AiOutlineFlag } from "react-icons/ai";
import { SlLayers } from "react-icons/sl";
import { RiVidiconLine } from "react-icons/ri";

export const features = [
  {
    id: 1,
    title: "Expert Teacher",
    description:
      "Develop skills for career of various majors including computer",
    icon: <AiOutlineFlag />,
  },
  {
    id: 2,
    title: "Self Development",
    description:
      "Develop skills for career of various majors including computer",
    icon: <SlLayers />,
  },
  {
    id: 3,
    title: "Remote Learning",
    description:
      "Develop skills for career of various majors including computer",
    icon: <RiVidiconLine />,
  },
];

export const team = [
  {
    id: 1,
    name: "Ali Muhammed",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/ali.png"),
  },
  {
    id: 2,
    name: "Shahdan Hegazy",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/shadan.heic"),
  },
  {
    id: 3,
    name: "Abdelrahman Hassan",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/abdo.jpg"),
  },
  {
    id: 4,
    name: "Dina Ziada",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/dina.jpg"),
  },
  {
    id: 5,
    name: "Ahmed Ezzat",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/ezzat.jpg"),
  },
  {
    id: 6,
    name: "Hannen Muhamed",
    dep: "Cs Student",
    image: require("../../assests/images/about page imgs/team/haneen.jpg"),
  },
];

export const materials = [
  { id: "1", name: "lec1", file: require("../../assests/materials/lec1.pdf") },
  { id: "2", name: "lec2", file: require("../../assests/materials/lec2.docx") },
  { id: "3", name: "lec3", file: require("../../assests/materials/lec3.pptx") },
  { id: "4", name: "lec4", file: require("../../assests/materials/lec4.txt") },
  { id: "5", name: "lec5", file: require("../../assests/materials/lec5.rar") },
  { id: "6", name: "lec6", file: require("../../assests/materials/lec6.zip") },
];
