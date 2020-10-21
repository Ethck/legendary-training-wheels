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


