import { TemporaryCombatantForm } from "../combat-utility-belt/modules/temporary-combatants/form.js";

Hooks.on("createCombatant", async (currCombat, currToken, options, currID) => {
    await new Promise(r => setTimeout(r, 20));

    if (currToken.actor.data.data.resources.lair.value){
        if (!currCombat.getFlag("legendary-training-wheels", "lair")){
            await currCombat.setFlag("legendary-training-wheels", "lair", {value: 20})
            console.log("Flag set.");
        }

        let acts = currToken.actor.data.data.resources.legact.value;
        
        const temporaryCombatantForm = new TemporaryCombatantForm({});
        await temporaryCombatantForm.render(true);
        await new Promise(r => setTimeout(r, 20));
        let tcForm = $(temporaryCombatantForm.form);
        tcForm.find('[name="name"]').val("Lair Action");
        tcForm.find('[name="init"]').val(20);
        tcForm.find('[name="hidden"]').attr("checked", true);
        temporaryCombatantForm.submit();
    }
})