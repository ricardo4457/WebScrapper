"use strict";

jest.mock("../../../src/scrapper/scraper.js", () => ({
  selectYearAndCycle: jest.fn().mockResolvedValue(),
  selectDistrict: jest.fn().mockResolvedValue(),
  selectCity: jest.fn().mockResolvedValue(),
  selectSchool: jest.fn().mockResolvedValue(),
  discoverCourses: jest.fn().mockResolvedValue([
    "Artes Visuais",
    "Ciências e Tecnologias",
  ]),
  waitForLoadingToFinish: jest.fn().mockResolvedValue(),
  resetToBasePage: jest.fn().mockResolvedValue(),
  navigateToLocation: jest.fn().mockResolvedValue(),
  scrapeSchool: jest.fn().mockResolvedValue([
    { title: "Manual X" },
  ]),
}));

jest.mock("../../../src/scrapper/selectors", () => ({
  BASE_URL: "https://example.com",
}));

jest.mock("../../../src/scrapper/blockDetection", () => ({
  assertNotBlocked: jest.fn().mockResolvedValue(),
}));

jest.mock("../../../src/utils/RunTimings", () => ({
  timed: jest.fn((page, name, callback) => callback()),
}));

const scraper = require("../../../src/scrapper/scraper");
const { assertNotBlocked } = require("../../../src/scrapper/blockDetection");

const FullTeachingCyleStrategy = require(
  "../../../src/strategies/implementations/FullTeachingCyleStrategy"
);

function makePage() {
  return {
    goto: jest.fn().mockResolvedValue({ status: () => 200 }),
  };
}

describe("FullTeachingCyleStrategy", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    scraper.discoverCourses.mockResolvedValue([
      "Artes Visuais",
      "Ciências e Tecnologias",
    ]);

    scraper.scrapeSchool.mockResolvedValue([
      { title: "Manual X" },
    ]);
  });

  describe("getTasks", () => {
    test("cria uma task por cada curso descoberto", async () => {
      const page = makePage();

      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      const tasks = await strategy.getTasks(page);

      expect(scraper.discoverCourses).toHaveBeenCalledWith(page);

      expect(tasks).toHaveLength(2);

      expect(tasks[0]).toEqual(
        expect.objectContaining({
          year: "2025/2026",
          teaching_cycle: "Secundário",
          district: "Porto",
          city: "Valongo",
          school: "Escola Secundária de Valongo",
          course: "Artes Visuais",
        })
      );

      expect(tasks[1]).toEqual(
        expect.objectContaining({
          year: "2025/2026",
          teaching_cycle: "Secundário",
          district: "Porto",
          city: "Valongo",
          school: "Escola Secundária de Valongo",
          course: "Ciências e Tecnologias",
        })
      );
    });

    test("seleciona ano/ciclo, distrito, cidade e escola antes de descobrir cursos", async () => {
      const page = makePage();

      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      await strategy.getTasks(page);

      expect(scraper.selectYearAndCycle).toHaveBeenCalledWith(page, {
        yearLabel: "2025/2026",
        teachingType: "Secundário",
      });

      expect(scraper.selectDistrict).toHaveBeenCalledWith(
        page,
        "Porto"
      );

      expect(scraper.selectCity).toHaveBeenCalledWith(
        page,
        "Valongo"
      );

      expect(scraper.selectSchool).toHaveBeenCalledWith(
        page,
        "Escola Secundária de Valongo"
      );

      expect(scraper.discoverCourses).toHaveBeenCalledWith(page);
    });

    test("não cria tasks quando não existem cursos", async () => {
      scraper.discoverCourses.mockResolvedValue([]);

      const page = makePage();

      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      const tasks = await strategy.getTasks(page);

      expect(tasks).toEqual([]);
    });

    test("usa cache e não volta a descobrir cursos numa segunda chamada", async () => {
      const page = makePage();

      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      const firstTasks = await strategy.getTasks(page);
      const secondTasks = await strategy.getTasks(page);

      expect(firstTasks).toEqual(secondTasks);

      expect(scraper.discoverCourses).toHaveBeenCalledTimes(1);
    });

    test("lança erro quando não é fornecida uma página", async () => {
      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      await expect(strategy.getTasks()).rejects.toThrow(
        "FullTeachingCyleStrategy.getTasks: a live page is required to discover schools."
      );
    });
  });

  describe("execute", () => {
    test("faz reset, navega para a task e executa o scraping", async () => {
      const page = makePage();

      const task = {
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
        course: "Artes Visuais",
      };

      const strategy = new FullTeachingCyleStrategy({
        year: "2025/2026",
        teaching_cycle: "Secundário",
        district: "Porto",
        city: "Valongo",
        school: "Escola Secundária de Valongo",
      });

      const result = await strategy.execute(page, task);

      expect(scraper.resetToBasePage).toHaveBeenCalledWith(page);

      expect(scraper.navigateToLocation).toHaveBeenCalledWith(
        page,
        task
      );

      expect(scraper.scrapeSchool).toHaveBeenCalledWith(
        page,
        task
      );

      expect(result).toEqual([
        { title: "Manual X" },
      ]);
    });
  });
});