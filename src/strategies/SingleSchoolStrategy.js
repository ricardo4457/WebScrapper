const BaseStrategy = require('./BaseStrategy');

/**
 * SingleSchoolStrategy
 *
 * Gera uma única tarefa de scraping para uma escola específica,
 * num ano/ciclo determinado.
 *
 * Caso de uso típico: re-scraping pontual de uma escola após edição
 * manual, ou teste de um fluxo completo sem correr todo o catálogo.
 *
 * Input esperado (params):
 * {
 *   ano:      '4.º',
 *   ciclo:    'Ensino Básico (1º Ciclo)',   // null se o ano não tiver ciclo
 *   distrito: 'Porto',
 *   concelho: 'Valongo',
 *   escola:   'Colégio de Ermesinde - Escola Católica'
 * }
 *
 * Output de getTasks():
 * [
 *   {
 *     ano, ciclo, distrito, concelho, escola
 *   }
 * ]
 */
class SingleSchoolStrategy extends BaseStrategy {
  /**
   * @param {object} params
   * @param {string} params.ano       - Ex: '4.º'
   * @param {string|null} params.ciclo    - Ex: 'Ensino Básico (1º Ciclo)' ou null
   * @param {string} params.distrito  - Ex: 'Porto'
   * @param {string} params.concelho  - Ex: 'Valongo'
   * @param {string} params.escola    - Nome exato como aparece no dropdown do Wook
   */
  constructor(params = {}) {
    super();
    this._validate(params);
    this.params = params;
  }

  /**
   * Valida que todos os campos obrigatórios estão presentes.
   * Falha cedo, antes de qualquer browser ser aberto.
   */
  _validate({ ano, distrito, concelho, escola }) {
    const missing = ['ano', 'distrito', 'concelho', 'escola'].filter(
      key => !{ ano, distrito, concelho, escola }[key]
    );
    if (missing.length > 0) {
      throw new Error(
        `SingleSchoolStrategy: campos obrigatórios em falta: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Devolve um array com uma única tarefa.
   * O Runner consome este array e passa cada item ao Scraper.
   *
   * @returns {Array<{ano: string, ciclo: string|null, distrito: string, concelho: string, escola: string}>}
   */
  getTasks() {
    const { ano, ciclo = null, distrito, concelho, escola } = this.params;
    return [{ ano, ciclo, distrito, concelho, escola }];
  }

  /**
   * Descrição legível da estratégia — útil para logs do Runner.
   * @returns {string}
   */
  describe() {
    const { ano, ciclo, distrito, concelho, escola } = this.params;
    const cicloStr = ciclo ? ` / ${ciclo}` : '';
    return `SingleSchool → ${escola} (${distrito} › ${concelho}) [${ano}${cicloStr}]`;
  }
}

module.exports = SingleSchoolStrategy;