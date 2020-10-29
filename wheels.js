import { TemporaryCombatantForm } from "../combat-utility-belt/modules/temporary-combatants/form.js";
import { LegActions } from "./legActions.js";


Hooks.on("createCombatant", async (currCombat, currToken, options, currID) => {
    await new Promise(r => setTimeout(r, 200));

    // Does this actor have lair actions?
    if (hasProperty(currToken, "actor.data.data.resources.lair.value") && currToken.actor.data.data.resources.lair.value){
        // Have we already made a Lair Action Combatant?
        if(!currCombat.combatants.find((combatant) => combatant.token.name === "Lair Action")){
            const temporaryCombatantForm = new TemporaryCombatantForm({});
            // Render form, wait to fill
            await temporaryCombatantForm.render(true);
            await new Promise(r => setTimeout(r, 200));
            // fill
            let tcForm = $(temporaryCombatantForm.form);
            tcForm.find('[name="name"]').val("Lair Action");
            tcForm.find('[name="init"]').val(20);
            tcForm.find('[name="hidden"]').attr("checked", true);
            // submit / create temp combatant
            temporaryCombatantForm.submit();
        }
    }
});


Hooks.on("updateCombat", async (currCombat, currOptions, isDiff, userID) => {
    let turn = currOptions.turn;
    // Find out where our Player Characters are in initiative.
    // And find our NPCs with legendary actions.
    let playerTurns = [];
    let legends = [];
    let legUpdates = [];
    currCombat.turns.forEach(async (combatant, pos) => {
        const legMax = getProperty(combatant, "token.actorData.data.resources.legact.max") || 
            getProperty(combatant, "actor.data.data.resources.legact.max");;
        if (getProperty(combatant, "actor").hasPlayerOwner) {
            playerTurns.push(pos);
        } else if (legMax){
            // Reset legendary actions when we get to the start of next entity's turn
            if (turn === pos + 1 || (turn === 0 && pos === currCombat.turns.length - 1)) {
                legUpdates.push({_id: combatant.token._id,  "actorData.data.resources.legact.value": legMax})
            }
            legends.push(combatant);
        }
    });
    // Update to reset leg actions
    await canvas.tokens.updateMany(legUpdates);

    if (!playerTurns) return;
    if (playerTurns.some((pTurn) => ((turn === pTurn + 1) || (turn === 0 && pTurn === currCombat.turns.length - 1)))){
        let activeLegends = legends.map((legendary) => {
            const rLA = getProperty(legendary, "token.actorData.data.resources.legact.value") ||
                getProperty(legendary, "actor.data.data.resources.legact.value")
            const mLA = getProperty(legendary, "token.actorData.data.resources.legact.max") ||
                getProperty(legendary, "actor.data.data.resources.legact.max")
            const lItems = getProperty(legendary, "token.actorData.data.items") || getProperty(legendary, "actor.data.items");
            return {
                name: getProperty(legendary, "name"),
                remainingLegActions: rLA,
                maxLegActions: mLA,
                legendaryItems: lItems.filter((litem) => {
                    if (hasProperty(litem, "data.activation") && litem.data.activation.type === "legendary") {
                        return litem;
                    }
                }),
                img: getProperty(legendary, "token.img"),
                _id: getProperty(legendary, "token._id")
            }
        })
        let myLegends = [];
        for (const legend of activeLegends){
            if (parseInt(legend.remainingLegActions) !== 0) {
                myLegends.push(legend)
            }
        }

        const notifType = game.settings.get("legendary-training-wheels", "notificationType");

        if (notifType === "dialog"){
            let form = new LegActions(myLegends);
            form.render(true);
        } else if (notifType === "toasts") {
            for (const myLeg of myLegends) {
                ui.notifications.notify(myLeg.name + " has " + myLeg.remainingLegActions + "/" + myLeg.maxLegActions + " Legendary Actions remaining this round.");
            }
        } else {
            // Something's wrong
        }
    }
})

Hooks.on("createChatMessage", async (message, options, id) => {
    if (message.isRoll) {
        if (getProperty(message, "data.flavor") && getProperty(message, "data.flavor").includes("Saving Throw")) {
            let legTok = canvas.tokens.get(getProperty(message, "data.speaker.token"));
            // Find legRes property. Either from the token first or from the actor
            const legRes = getProperty(legTok, "actorData.data.resources.legres.value") || getProperty(legTok, "actor.data.data.resources.legres.value");
            if (legRes){
                // Do the same with finding the max
                const maxRes = getProperty(legTok, "actorData.data.resources.legres.max") || getProperty(legTok, "actor.data.data.resources.legres.max");

                const notifType = game.settings.get("legendary-training-wheels", "notificationType");

                if (notifType === "dialog"){
                    let use = false;
                    let d = new Dialog({
                      title: 'Legendary Resistance',
                      content: `A Saving Throw has been detected. Would you like to use Legendary Resistance to ignore it? You have ` + legRes + `/` + maxRes + ` resistances remaining.`,
                      buttons: {
                        yes: {
                          icon: '<i class="fas fa-check"></i>',
                          label: 'Yes',
                          callback: () => (use = true),
                        },
                        no: {
                            icon: '<i class="fas fa-close"></i>',
                            label: 'No',
                            callback: () => (use = false),
                        }
                      },
                      close: async (html) => {
                          if (use) {
                            let legActor = game.actors.get(getProperty(message, "data.speaker.actor"));
                            ChatMessage.create({
                                user: game.user._id,
                                speaker: ChatMessage.getSpeaker({legActor}),
                                content: "If the creature fails a saving throw, it can choose to succeed instead.",
                                flavor: "has used Legendary Resistance to succeed on the save!",
                                type: CONST.CHAT_MESSAGE_TYPES.IC,
                              });
                            
                            await legTok.update({"actorData.data.resources.legres.value": legRes - 1});
                          }
                        },
                    }).render(true);
                }
            } else if (notifType === "toasts") {
                ui.notifications.notify(legTok.name + " still has Legendary Resistances. " + legRes + "/" + maxRes)
            } else {
                // Something's wrong
            }
        }
    }
})

Hooks.once("init", () => {
  game.settings.register("legendary-training-wheels", "notificationType", {
    name: "Level of Notifications",
    hint: "How often do you want to be bothered?",
    scope: "world",
    config: true,
    type: String,
    choices: {
      dialog: "Dialog popups with buttons!",
      toasts: "All messages will be toasts. No buttons."
    },
    default: "dialog",
  });
});