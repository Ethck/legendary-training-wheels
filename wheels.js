import { TemporaryCombatantForm } from "../combat-utility-belt/modules/temporary-combatants/form.js";

Hooks.on("createCombatant", async (currCombat, currToken, options, currID) => {
    await new Promise(r => setTimeout(r, 200));

    // Does this actor have lair actions?
    if (hasProperty(currToken, "actor.data.data.resources.lair.value") && currToken.actor.data.data.resources.lair.value){
        // Have we already made a Lair Action Combatant?
        if(!currCombat.combatants.find((combatant) => combatant.token.name === "Lair Action")){
            const temporaryCombatantForm = new TemporaryCombatantForm({});
            // Render form, wait to fill
            await temporaryCombatantForm.render(true);
            await new Promise(r => setTimeout(r, 20));
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
        if (getProperty(combatant, "actor").isPC) {
            playerTurns.push(pos);
        } else if (legMax){
            if ("round" in currOptions) { // Reset legendary actions when we get to the start of init
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
            console.log(legendary);
            const rLA = getProperty(legendary, "token.actorData.data.resources.legact.value") ||
                getProperty(legendary, "actor.data.data.resources.legact.value")
            const lItems = getProperty(legendary, "token.actorData.data.items") || getProperty(legendary, "actor.data.items");
            return {
                name: getProperty(legendary, "name"),
                remainingLegActions: rLA,
                legendaryItems: lItems.filter((litem) => {
                    if (hasProperty(litem, "data.activation") && litem.data.activation.type === "legendary") {
                        return litem;
                    }
                })
            }
        })
        for (const legend of activeLegends){
            if (parseInt(legend.remainingLegActions) !== 0) {
                let content = "";
                for (const attack of legend.legendaryItems) {
                    content += "Name: " + attack.name + " Cost: " + attack.data.consume.amount + "</br>";
                }
                let d = new Dialog({
                    title: 'Legendary Actions',
                    content: content + `Creature ` + legend.name + ` is in the combat with ` + legend.remainingLegActions + ` Legendary Actions left.`,
                    buttons: {
                        ok: {
                          icon: '<i class="fas fa-check"></i>',
                          label: 'Ok',
                        },
                    }
                }).render(true);
            }
        }
    }
})