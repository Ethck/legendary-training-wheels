export class LegActions extends FormApplication {
  constructor(legends, ...args) {
    super(...args);
    game.users.apps.push(this);
    this.legends = legends;
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
    console.log(legends[0])
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
    const legToken = canvas.tokens.get($(event.target).attr("name"))
    let attack = legToken.actor.items.getName($(event.target).attr("id"));

    // Thanks D&D5e System!
    if ( attack.data.type === "spell" ) return legToken.useSpell(attack);
    return attack.roll();
  }

  async _updateObject(event, formData) {
    return;
  }
}
