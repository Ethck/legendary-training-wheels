import { LegActions } from "./legActions.js";

// If adding a combatant that has a lair action, make a hidden temporary
// combatant at init 20 to remind.
Hooks.on("createCombatant", async (currToken, options, id) => {
    if (!game.user.isGM) return;
    await new Promise((r) => setTimeout(r, 200));

    // Does this actor have lair actions?
    const currCombat = currToken.parent.data;
    if (
        hasProperty(currToken, "actor.system.resources.lair.value") &&
        currToken.actor.system.resources.lair.value
    ) {
        // Have we already made a Lair Action Combatant?
        if (!currCombat.combatants.find((combatant) => combatant.token.name === "Lair Action")) {
            const lair = game.actors.getName("Lair Action");
            let actor;
            if (!lair) {
                let actorData = await Actor.createDocuments([
                    {
                        name: "Lair Action",
                        type: "npc",
                        img: "icons/svg/mystery-man.svg",
                    },
                ]);
                actor = actorData[0];
            } else {
                actor = lair;
            }

            const lairToken = canvas.scene.tokens.getName("Lair Action");
            let token;
            if (!lairToken) {
                const tokenData = duplicate(actor.token);
                tokenData.x = 0;
                tokenData.y = 0;
                tokenData.disposition = 0;
                tokenData.img = "icons/svg/mystery-man.svg";
                tokenData.actorId = actor.id;
                tokenData.actorLink = true;
                const tData = await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
                token = tData[0];
            } else {
                token = lairToken;
            }

            const combatant = await game.combat.createEmbeddedDocuments("Combatant", [
                {
                    tokenId: token.id,
                    hidden: true,
                    initiative: 20,
                    "flags.legendary-training-wheels.lairaction": true,
                },
            ]);
        }
    }
});

// Keep track of when it's a player's turn and when it is a legendary
// creatures turn.
Hooks.on("updateCombat", async (currCombat, currOptions, isDiff, userID) => {
    if (!game.user.isGM) return;
    let turn = currOptions.turn;
    // Find out where our non-legendary characters are in initiative.
    // And find our NPCs with legendary actions.
    let nonLegendTurns = [];
    let legends = [];
    let legUpdates = [];
    currCombat.turns.forEach(async (combatant, pos) => {
        if (getProperty(combatant, "actor.name") === "Lair Action") return;
        const legMax =
            getProperty(combatant, "token.actorData.system.resources.legact.max") ||
            getProperty(combatant, "actor.system.resources.legact.max");
        // Track legendary turns
        if (legMax) {
            // Reset legendary actions when we get to the start of next turn AFTER the legendary.
            if (turn === pos + 1 || (turn === 0 && pos === currCombat.turns.length - 1)) {
                legUpdates.push({ _id: combatant.token.id, "actorData.system.resources.legact.value": legMax });
            }
            // We can only use legendary actions at the END of ANOTHER creature's turn
            // this means that it can't be the start of the creature's turn that follows ours :(
            // because that is *actually* the trigger for the end of OUR turn
            if (pos + 1 !== turn) {
                // This is necessary to cover the circular edge case
                if (turn === 0 && pos === currCombat.turns.length - 1) {
                    // Just ignore this
                } else {
                    legends.push(combatant);
                }
            }
        } else {
            nonLegendTurns.push(pos);
        }
    });
    if (legUpdates) {
        // Update to reset leg actions
        await canvas.scene.updateEmbeddedDocuments("Token", legUpdates);
    }

    if (!nonLegendTurns.length) return; // If no non-legendaries, don't prompt for legActions
    if (!legends.length) return; // If no creatures with legendary actions, don't continue.

    // Determine if any lairActions are present (there should only be 1, but whatever)
    const lairActions = currCombat.turns
        .filter((combatant) => combatant.flags["legendary-training-wheels"]?.lairaction)
        .map((combatant) => {
            return combatant.id;
        });
    // Find the id of the previous turn
    let prevTurnId;
    if (currCombat.turn === 0) {
        prevTurnId = currCombat.turns[currCombat.turns.length - 1].id;
    } else {
        prevTurnId = currCombat.turns[currCombat.turn - 1].id;
    }
    // If it's our custom "Lair Action" token, then return early
    if (lairActions.includes(prevTurnId)) return;

    // An "Active" legend is any creature with legendary actions
    // who CAN USE thier legendary actions.
    // For this to be the case, it can NOT be the turn
    // that immediately follows that legend's turn.
    let activeLegends = legends.map((legendary) => {
        // Remaining Legendary Actions
        const rLA =
            getProperty(legendary, "token.actorData.system.resources.legact.value") ||
            getProperty(legendary, "actor.system.resources.legact.value");
        // Maximum Legendary Actions
        const mLA =
            getProperty(legendary, "token.actorData.system.resources.legact.max") ||
            getProperty(legendary, "actor.system.resources.legact.max");
        // Legendary Items/Abilities/Features/etc.
        const lItems =
            getProperty(legendary, "token.actorData.items") || getProperty(legendary, "actor.items");
        return {
            name: getProperty(legendary, "name"),
            remainingLegActions: rLA,
            maxLegActions: mLA,
            legendaryItems: lItems.filter((litem) => {
                if (hasProperty(litem, "system.activation") && litem.system.activation.type === "legendary") {
                    return litem;
                }
            }),
            img: getProperty(legendary, "img"),
            _id: getProperty(legendary, "token.id"),
        };
    });

    let myLegends = [];
    for (const legend of activeLegends) {
        if (parseInt(legend.remainingLegActions) !== 0) {
            myLegends.push(legend);
        }
    }

    const notifType = game.settings.get("legendary-training-wheels", "notificationType");

    if (notifType === "dialog") {
        let form = new LegActions(myLegends);
        form.render(true);
    } else if (notifType === "toasts") {
        for (const myLeg of myLegends) {
            ui.notifications.notify(
                myLeg.name +
                    " has " +
                    myLeg.remainingLegActions +
                    "/" +
                    myLeg.maxLegActions +
                    " Legendary Actions remaining this round."
            );
        }
    }
});

Hooks.on("createChatMessage", async (message, options, id) => {
    if (!game.user.isGM) return;
    if (message.rolls) {
        // TODO Better rolls is no longer maintained. Probably need to test with and account for
        // Ready Set Roll for 5e - https://github.com/MangoFVTT/fvtt-ready-set-roll-5e
        // BetterRolls 5e
        const isBRSave = $(message.content).find("img")?.attr("title")?.toLowerCase()?.includes("save");

        if (
            (getProperty(message, "flavor") && getProperty(message, "flavor").includes("Saving Throw")) ||
            isBRSave
        ) {
            let legTok;
            if (isBRSave) {
                legTok = canvas.scene.tokens.getName(getProperty(message, "speaker.alias"));
            } else {
                legTok = canvas.scene.tokens.get(getProperty(message, "speaker.token"));
            }
            // Find legRes property. Either from the token first or from the actor
            const legRes =
                getProperty(legTok, "actorData.system.resources.legres.value") ||
                getProperty(legTok, "actor.system.resources.legres.value");
            if (legRes) {
                // Do the same with finding the max
                const maxRes =
                    getProperty(legTok, "actorData.system.resources.legres.max") ||
                    getProperty(legTok, "actor.system.resources.legres.max");

                const notifType = game.settings.get("legendary-training-wheels", "notificationType");
                if (notifType === "dialog") {
                    let use = false;
                    let d = new Dialog({
                        title: "Legendary Resistance",
                        content:
                            `A Saving Throw has been detected. Would you like to use Legendary Resistance to ignore it? You have ` +
                            legRes +
                            `/` +
                            maxRes +
                            ` resistances remaining.`,
                        buttons: {
                            yes: {
                                icon: '<i class="fas fa-check"></i>',
                                label: "Yes",
                                callback: () => (use = true),
                            },
                            no: {
                                icon: '<i class="fas fa-close"></i>',
                                label: "No",
                                callback: () => (use = false),
                            },
                        },
                        close: async (html) => {
                            if (use) {
                                let legActor = game.actors.get(getProperty(message, "speaker.actor"));
                                ChatMessage.create({
                                    user: game.user.id,
                                    speaker: ChatMessage.getSpeaker({ legActor }),
                                    content: "If the creature fails a saving throw, it can choose to succeed instead.",
                                    flavor: "has used Legendary Resistance to succeed on the save!",
                                    type: CONST.CHAT_MESSAGE_TYPES.IC,
                                });
                                await legTok.document.update({
                                    "actorData.system.resources.legres.value": legRes - 1,
                                });
                            }
                        },
                    }).render(true);
                } else if (notifType === "toasts") {
                    ui.notifications.notify(legTok.name + " still has Legendary Resistances. " + legRes + "/" + maxRes);
                }
            }
        }
    }
});

Hooks.once("init", () => {
    game.settings.register("legendary-training-wheels", "notificationType", {
        name: "Level of Notifications",
        hint: "How often do you want to be bothered?",
        scope: "world",
        config: true,
        type: String,
        choices: {
            dialog: "Dialog popups with buttons!",
            toasts: "All messages will be toasts. No buttons.",
        },
        default: "dialog",
    });
});
