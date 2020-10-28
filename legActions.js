export class LegActions extends FormApplication {
  constructor(legends, ...args) {
    super(...args);
    game.users.apps.push(this);
    this.legends = legends;
    this.count = 0;
  }

  static get defaultOptions() {
    const options = super.defaultOptions;
    options.title = "Legendary Actions";
    options.id = "legendary-training-wheels";
    options.template = "modules/legendary-training-wheels/templates/legendary-actions.html";
    options.closeOnSubmit = true;
    options.popOut = true;
    options.width = 600;
    options.height = "auto";
    return options;
  }

  async getData() {
    const legends = this.legends;
    return {
      legends: legends

    };
  }

  render(force, context = {}) {
    return super.render(force, context);
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.find("button").click((event) => this.handleItem(event));
  }

  handleItem(event) {
    let elem = $(event.target).parent()
    // this is actually the token id... to get token
    const legToken = canvas.tokens.get(elem.attr("name"))
    // find the attack being used, by name
    let attack = legToken.actor.items.getName(elem.attr("id"));

    // Thanks D&D5e System!
    if ( attack.data.type === "spell" ) {
      legToken.useSpell(attack);
    } else {
      attack.roll();
    }

    elem.parent().parent().find("button").prop("disabled",true);

    this.count += 1;
    // auto submit when all actions are used.
    if (this.count === this.legends.length) {
      this.submit();
    }

  }

  async _updateObject(event, formData) {
    return;
  }
}
